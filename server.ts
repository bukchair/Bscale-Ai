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

        // debug: WooCommerce ${method} → ${urlObj.origin}${urlObj.pathname}
        
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
        // Attempt 1 failed (${response.status}), trying with index.php...
        apiUrl = `${baseUrl}/index.php/wp-json/wc/v3/${endpointPath}`;
        response = await tryFetch(apiUrl);
      }

      // Try 3: Legacy API if still failing
      if (response.status === 405 || response.status === 404) {
        // Attempt 2 failed (${response.status}), trying legacy API path...
        apiUrl = `${baseUrl}/wc-api/v3/${endpointPath}`;
        response = await tryFetch(apiUrl);
      }

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
      prompt: "consent"
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

  app.get("/api/google/ads/accounts", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    if (!accessToken) {
      return res.status(400).json({ message: "Missing access token" });
    }
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      return res.status(500).json({ message: "Google Ads developer token not configured" });
    }
    try {
      const response = await axios.get("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
        },
      });
      res.json(response.data);
    } catch (error: any) {
      const data = error.response?.data;
      const msg = data?.error?.message || data?.message || error.message;
      res.status(error.response?.status || 500).json({ message: msg });
    }
  });

  app.get("/api/google/ads/campaigns", async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const customerId = req.query.customer_id;

    if (!accessToken || !customerId) {
      return res.status(400).json({ message: "Missing access token or customer ID" });
    }

    try {
      const formattedCustomerId = String(customerId).replace(/-/g, "");
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

    if (!accessToken || !propertyId) {
      return res.status(400).json({ message: "Missing access token or property ID" });
    }

    try {
      const response = await axios.post(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
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

    if (!accessToken || !siteUrl) {
      return res.status(400).json({ message: "Missing access token or site URL" });
    }

    try {
      const encodedSiteUrl = encodeURIComponent(siteUrl as string);
      const response = await axios.post(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`,
        {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 10
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
    console.info(`Server running on port ${PORT}`);
  });
}

startServer();
