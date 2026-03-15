import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const getBearerToken = (req: express.Request) => req.headers.authorization?.split(" ")[1];

  const getAxiosErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const apiMessage = (error.response?.data as any)?.error?.message || (error.response?.data as any)?.message;
      return apiMessage || error.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  };

  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };
  const getDateRangeFromQuery = (req: express.Request, defaultDays = 30) => {
    const startDateQuery = req.query.start_date;
    const endDateQuery = req.query.end_date;
    const startDate = typeof startDateQuery === "string" && DATE_PATTERN.test(startDateQuery) ? startDateQuery : null;
    const endDate = typeof endDateQuery === "string" && DATE_PATTERN.test(endDateQuery) ? endDateQuery : null;

    if (startDate && endDate) {
      return startDate <= endDate
        ? { startDate, endDate }
        : { startDate: endDate, endDate: startDate };
    }

    const today = new Date();
    return {
      startDate: formatDate(addDays(today, -(defaultDays - 1))),
      endDate: formatDate(today),
    };
  };

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // WooCommerce Proxy Endpoint
  app.post("/api/proxy/woocommerce", express.json(), async (req, res) => {
    const { url, key, secret, endpoint } = req.body;

    if (!url || !key || !secret) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    try {
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }
      
      const baseUrl = formattedUrl.endsWith('/') ? formattedUrl.slice(0, -1) : formattedUrl;
      const endpointPath = endpoint || 'system_status';
      const method = req.body.method || 'GET';

      const tryFetch = async (targetUrl: string) => {
        const urlObj = new URL(targetUrl);
        
        // Add auth to query params as a fallback
        urlObj.searchParams.append('consumer_key', key);
        urlObj.searchParams.append('consumer_secret', secret);

        const auth = Buffer.from(`${key}:${secret}`).toString('base64');
        const headers: Record<string, string> = {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': baseUrl + '/'
        };

        if (method === 'PUT' || method === 'POST') {
          headers['Content-Type'] = 'application/json';
        }

        console.log(`Attempting WooCommerce ${method} request to: ${urlObj.origin}${urlObj.pathname}`);
        
        const options: RequestInit = {
          method,
          headers,
          redirect: 'follow'
        };

        if ((method === 'PUT' || method === 'POST') && req.body.data) {
          options.body = JSON.stringify(req.body.data);
        }
        
        return await fetch(urlObj.toString(), options);
      };
      
      // Try 1: Standard REST API path
      let apiUrl = `${baseUrl}/wp-json/wc/v3/${endpointPath}`;
      let response = await tryFetch(apiUrl);

      // Try 2: If 405 or 404, try with index.php
      if (response.status === 405 || response.status === 404) {
        console.log(`Attempt 1 failed (${response.status}), trying with index.php...`);
        apiUrl = `${baseUrl}/index.php/wp-json/wc/v3/${endpointPath}`;
        response = await tryFetch(apiUrl);
      }

      // Try 3: Legacy API if still failing
      if (response.status === 405 || response.status === 404) {
        console.log(`Attempt 2 failed (${response.status}), trying legacy API path...`);
        apiUrl = `${baseUrl}/wc-api/v3/${endpointPath}`;
        response = await tryFetch(apiUrl);
      }

      console.log(`Final WooCommerce response status: ${response.status}`);
      const text = await response.text();
      
      let data;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.warn("Failed to parse WooCommerce response as JSON:", text.substring(0, 200));
          return res.status(response.status || 500).json({ 
            message: `The server returned a non-JSON response (${response.status}).`,
            debug: text.substring(0, 100)
          });
        }
      } else {
        console.warn("Received empty response from WooCommerce");
        return res.status(response.status || 500).json({ 
          message: `The server returned an empty response (${response.status}).`
        });
      }
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error) {
      console.error("Proxy Error:", error);
      res.status(500).json({ message: "Failed to connect to WooCommerce store. Please check the URL and ensure it's accessible." });
    }
  });

  // TikTok OAuth Routes
  app.get("/api/auth/tiktok/url", (req, res) => {
    const appId = process.env.TIKTOK_APP_ID;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/tiktok/callback`;
    
    if (!appId) {
      return res.status(500).json({ message: "TikTok App ID not configured" });
    }

    const authUrl = `https://ads.tiktok.com/marketing_api/auth?app_id=${appId}&state=state&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/tiktok/callback", async (req, res) => {
    const { auth_code } = req.query;
    
    if (!auth_code) {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'No auth code provided' }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    }

    try {
      const response = await axios.post("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
        app_id: process.env.TIKTOK_APP_ID,
        secret: process.env.TIKTOK_SECRET,
        auth_code: auth_code
      });

      const data = response.data;
      
      if (data.code !== 0) {
        throw new Error(data.message || "Failed to exchange token");
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  platform: 'tiktok',
                  data: ${JSON.stringify(data.data)}
                }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("TikTok Auth Error:", error.response?.data || error.message);
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Failed to authenticate with TikTok' }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    }
  });

  app.get("/api/tiktok/campaigns", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const advertiserId = req.query.advertiser_id;

    if (!accessToken || !advertiserId) {
      return res.status(400).json({ message: "Missing access token or advertiser ID" });
    }

    try {
      const response = await axios.get(`https://business-api.tiktok.com/open_api/v1.3/campaign/get/`, {
        params: {
          advertiser_id: advertiserId,
        },
        headers: {
          "Access-Token": accessToken,
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("TikTok API Error:", error.response?.data || error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Meta OAuth Routes
  app.get("/api/auth/meta/url", (req, res) => {
    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/meta/callback`;
    
    if (!appId) {
      return res.status(500).json({ message: "Meta App ID not configured" });
    }

    // Permissions needed for Ads management
    const scope = "ads_management,ads_read,business_management,public_profile";
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/meta/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/meta/callback`;
    
    if (!code) {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'No auth code provided' }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    }

    try {
      const response = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: redirectUri,
          code: code
        }
      });

      const data = response.data;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  platform: 'meta',
                  data: ${JSON.stringify(data)}
                }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Meta Auth Error:", error.response?.data || error.message);
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Failed to authenticate with Meta' }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    }
  });

  app.get("/api/meta/campaigns", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const adAccountId = req.query.ad_account_id;

    if (!accessToken || !adAccountId) {
      return res.status(400).json({ message: "Missing access token or ad account ID" });
    }

    try {
      // Ad account ID should be prefixed with act_ if it isn't
      const adAccountIdStr = String(adAccountId);
      const formattedAdAccountId = adAccountIdStr.startsWith('act_') ? adAccountIdStr : `act_${adAccountIdStr}`;
      const response = await axios.get(`https://graph.facebook.com/v19.0/${formattedAdAccountId}/campaigns`, {
        params: {
          fields: 'id,name,status,objective,start_time,stop_time,spend,insights{spend,inline_link_click_ctr,roas}',
          access_token: accessToken,
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Meta API Error:", error.response?.data || error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.get(["/api/auth/google/url", "/api/auth/google/url/"], (req, res) => {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
    const forceAccountSelection = String(req.query.select_account || "") === "1";
    const scopes = [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ];

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: "Google Client ID not configured" });
    }

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: forceAccountSelection ? "select_account consent" : "consent"
    });

    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

    try {
      const response = await axios.post("https://oauth2.googleapis.com/token", {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code: code
      });

      const data = response.data;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  platform: 'google',
                  tokens: ${JSON.stringify(data)} 
                }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Google Auth Error:", error.response?.data || error.message);
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', platform: 'google', error: 'Failed to authenticate with Google' }, '*');
                window.close();
              }
            </script>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/auth/google/refresh", express.json(), async (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
      return res.status(400).json({ message: "Missing refresh_token" });
    }

    try {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token,
      });

      const response = await axios.post("https://oauth2.googleapis.com/token", params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      res.json(response.data);
    } catch (error) {
      console.error("Google token refresh error:", (error as any)?.response?.data || (error as any)?.message || error);
      res.status(500).json({ message: getAxiosErrorMessage(error, "Failed to refresh Google token") });
    }
  });

  app.get("/api/google/discover", async (req, res) => {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(400).json({ message: "Missing access token" });
    }

    const discovered: Record<string, string> = {};
    const warnings: string[] = [];

    // Discover GA4 properties from account summaries
    try {
      const ga4Response = await axios.get("https://analyticsadmin.googleapis.com/v1alpha/accountSummaries", {
        params: { pageSize: 200 },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const firstProperty = (ga4Response.data.accountSummaries || [])
        .flatMap((summary: any) => summary.propertySummaries || [])
        .find((property: any) => property?.property);

      if (firstProperty?.property) {
        discovered.ga4PropertyId = String(firstProperty.property).replace("properties/", "");
        if (firstProperty.displayName) {
          discovered.ga4PropertyName = firstProperty.displayName;
        }
      }
    } catch (error) {
      warnings.push(`GA4 discovery failed: ${getAxiosErrorMessage(error, "Unknown GA4 error")}`);
    }

    // Discover Search Console verified site
    try {
      const gscResponse = await axios.get("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const site = (gscResponse.data.siteEntry || []).find((entry: any) =>
        entry.permissionLevel && entry.permissionLevel !== "siteUnverified"
      );
      if (site?.siteUrl) {
        discovered.gscSiteUrl = site.siteUrl;
      }
    } catch (error) {
      warnings.push(`Search Console discovery failed: ${getAxiosErrorMessage(error, "Unknown GSC error")}`);
    }

    // Discover Google Ads customer if developer token is configured
    if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
      try {
        const adsResponse = await axios.get("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN
          }
        });
        const firstCustomerResource = adsResponse.data.resourceNames?.[0];
        if (firstCustomerResource) {
          discovered.googleAdsId = String(firstCustomerResource).replace("customers/", "");
        }
      } catch (error) {
        warnings.push(`Google Ads discovery failed: ${getAxiosErrorMessage(error, "Unknown Google Ads error")}`);
      }
    } else {
      warnings.push("Google Ads discovery skipped: GOOGLE_ADS_DEVELOPER_TOKEN is not configured.");
    }

    res.json({ discovered, warnings });
  });

  app.get("/api/google/validate", async (req, res) => {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(400).json({ message: "Missing access token" });
    }

    try {
      const userInfoRes = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      res.json({
        valid: true,
        account: {
          sub: userInfoRes.data?.sub,
          email: userInfoRes.data?.email,
          name: userInfoRes.data?.name,
          picture: userInfoRes.data?.picture,
        }
      });
    } catch (error) {
      res.status(401).json({ message: getAxiosErrorMessage(error, "Invalid Google token") });
    }
  });

  app.get("/api/google/ads/campaigns", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const customerId = req.query.customer_id;
    const { startDate, endDate } = getDateRangeFromQuery(req, 30);

    if (!accessToken || !customerId) {
      return res.status(400).json({ message: "Missing access token or customer ID" });
    }

    try {
      const formattedCustomerId = String(customerId).replace(/-/g, "");
      const dateFilter = `AND segments.date BETWEEN '${startDate}' AND '${endDate}'`;
      const response = await axios.post(
        `https://googleads.googleapis.com/v17/customers/${formattedCustomerId}/googleAds:search`,
        {
          query: `
            SELECT 
              campaign.id, 
              campaign.name, 
              campaign.status, 
              metrics.cost_micros, 
              metrics.conversions, 
              metrics.absolute_top_impression_percentage
            FROM campaign 
            WHERE campaign.status != 'REMOVED'
            ${dateFilter}
          `
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN as string,
            "login-customer-id": (req.query.login_customer_id as string) || formattedCustomerId
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Google Ads API Error:", error.response?.data || error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/google/analytics/live", async (req, res) => {
    const accessToken = getBearerToken(req);
    const propertyId = req.query.property_id;
    const { startDate, endDate } = getDateRangeFromQuery(req, 30);

    if (!accessToken) {
      return res.status(400).json({ message: "Missing access token" });
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    const dateRanges = [{ startDate, endDate }];
    const normalizePropertyId = (value: string) => value.replace("properties/", "").trim();

    const discoverFirstGa4PropertyId = async (): Promise<string | null> => {
      try {
        const response = await axios.get("https://analyticsadmin.googleapis.com/v1alpha/accountSummaries", {
          params: { pageSize: 200 },
          headers,
        });
        const firstProperty = (response.data.accountSummaries || [])
          .flatMap((summary: any) => summary.propertySummaries || [])
          .find((property: any) => property?.property);
        if (!firstProperty?.property) return null;
        return normalizePropertyId(String(firstProperty.property));
      } catch {
        return null;
      }
    };

    const fetchGa4LiveForProperty = async (normalizedPropertyId: string) => {
      const realtimeUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runRealtimeReport`;
      const reportUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`;

      const [activeNowRes, totalUsersRes, topPagesRes, sourcesRes] = await Promise.all([
        axios.post(realtimeUrl, { metrics: [{ name: "activeUsers" }] }, { headers }),
        axios.post(reportUrl, {
          dateRanges,
          metrics: [{ name: "totalUsers" }]
        }, { headers }),
        axios.post(reportUrl, {
          dateRanges,
          dimensions: [{ name: "unifiedPagePathScreen" }],
          metrics: [{ name: "totalUsers" }],
          limit: 3,
          orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }]
        }, { headers }),
        axios.post(reportUrl, {
          dateRanges,
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          limit: 5,
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
        }, { headers })
      ]);

      const activeUsers = Number(activeNowRes.data.rows?.[0]?.metricValues?.[0]?.value || 0);
      const totalUsers = Number(totalUsersRes.data.rows?.[0]?.metricValues?.[0]?.value || 0);

      const topPages = (topPagesRes.data.rows || []).map((row: any) => ({
        name: row.dimensionValues?.[0]?.value || "/",
        users: Number(row.metricValues?.[0]?.value || 0)
      }));

      const sourceRows = (sourcesRes.data.rows || []).map((row: any) => ({
        name: row.dimensionValues?.[0]?.value || "Other",
        users: Number(row.metricValues?.[0]?.value || 0)
      }));
      const totalSourceUsers = sourceRows.reduce((sum: number, row: any) => sum + row.users, 0);
      const trafficSources = sourceRows.map((row: any) => ({
        name: row.name,
        users: row.users,
        percent: totalSourceUsers > 0 ? Math.round((row.users / totalSourceUsers) * 100) : 0
      }));

      return {
        activeUsers,
        totalUsers,
        topPages,
        trafficSources,
        propertyIdUsed: normalizedPropertyId,
      };
    };

    const requestedPropertyId =
      typeof propertyId === "string" && propertyId.trim()
        ? normalizePropertyId(String(propertyId))
        : "";
    const candidateIds: string[] = [];
    if (requestedPropertyId) {
      candidateIds.push(requestedPropertyId);
    }

    const discoveredPropertyId = await discoverFirstGa4PropertyId();
    if (discoveredPropertyId && !candidateIds.includes(discoveredPropertyId)) {
      candidateIds.push(discoveredPropertyId);
    }

    if (!candidateIds.length) {
      return res.status(400).json({
        message: "No accessible GA4 property was found. Reconnect Google and select/enter a valid GA4 Property ID.",
      });
    }

    let lastError: unknown = null;
    for (const candidateId of candidateIds) {
      try {
        const payload = await fetchGa4LiveForProperty(candidateId);
        return res.json(payload);
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    console.error("GA4 live API Error:", (lastError as any)?.response?.data || (lastError as any)?.message || lastError);
    return res.status(500).json({
      message: getAxiosErrorMessage(lastError, "Failed to fetch live GA4 data"),
      attemptedPropertyIds: candidateIds,
    });
  });

  app.post("/api/google/gmail/send", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const { to, subject, body } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: "Missing access token" });
    }

    try {
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await axios.post(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        { raw: encodedMessage },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Gmail API Error:", error.response?.data || error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/google/analytics/report", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const propertyId = req.query.property_id;
    const { startDate, endDate } = getDateRangeFromQuery(req, 30);

    if (!accessToken || !propertyId) {
      return res.status(400).json({ message: "Missing access token or property ID" });
    }

    try {
      const normalizedPropertyId = String(propertyId).replace("properties/", "");
      const response = await axios.post(
        `https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`,
        {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'totalRevenue' }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("GA4 API Error:", error.response?.data || error.message);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/google/search-console/query", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const siteUrl = req.query.site_url;
    const { startDate, endDate } = getDateRangeFromQuery(req, 30);
    const rowLimit = Number(req.query.row_limit);

    if (!accessToken || !siteUrl) {
      return res.status(400).json({ message: "Missing access token or site URL" });
    }

    try {
      const encodedSiteUrl = encodeURIComponent(siteUrl as string);
      const response = await axios.post(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
        {
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: Number.isFinite(rowLimit) && rowLimit > 0 ? Math.floor(rowLimit) : 10
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("GSC API Error:", error.response?.data || error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the 'dist' directory in production
    app.use(express.static(path.join(__dirname, "dist")));
    
    // Handle SPA routing: serve index.html for any unknown paths
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
