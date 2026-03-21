import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';
import {
  buildGoogleOAuthUrl,
  consumeOAuthState,
  disconnectServiceConnection,
  exchangeCodeForServiceToken,
  getValidServiceAccessToken,
  googleServiceCatalog,
  listGoogleServiceConnections,
  resolveAuthorizedUserIdFromRequest,
  saveServiceConnection,
  toPublicGoogleServicePayload,
  type GoogleServiceSlug,
} from '../../src/server/google-store';

type Req = IncomingMessage & {
  query?: Record<string, string>;
  body?: any;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message =
      (error.response?.data as any)?.error?.message ||
      (error.response?.data as any)?.message ||
      error.message;
    return message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const parseUrl = (req: IncomingMessage) => {
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return new URL(req.url || '/', `${proto}://${host}`);
};

const parseQuery = (url: URL): Record<string, string> => {
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  return query;
};

const parseJsonBody = async (req: IncomingMessage): Promise<any> => {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
};

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
};

const sendPopup = (res: ServerResponse, options: { success: boolean; service: string; error?: string }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`
    <html>
      <body>
        <script>
          (function () {
            if (window.opener) {
              window.opener.postMessage({
                type: '${options.success ? 'OAUTH_AUTH_SUCCESS' : 'OAUTH_AUTH_ERROR'}',
                platform: 'google-service',
                service: '${options.service}',
                ${options.success ? "status: 'connected'" : `error: ${JSON.stringify(options.error || 'OAuth failed')}`}
              }, '*');
            }
            window.close();
          })();
        </script>
      </body>
    </html>
  `);
};

const isServiceSlug = (value: string): value is GoogleServiceSlug =>
  ['google-ads', 'ga4', 'search-console', 'gmail'].includes(value);

const redirectEnvBySlug: Record<GoogleServiceSlug, string | undefined> = {
  'google-ads': process.env.GOOGLE_ADS_REDIRECT_URI,
  ga4: process.env.GA4_REDIRECT_URI,
  'search-console': process.env.SEARCH_CONSOLE_REDIRECT_URI,
  gmail: process.env.GMAIL_REDIRECT_URI,
};

const getRedirectUri = (req: IncomingMessage, serviceSlug: GoogleServiceSlug) => {
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return (
    redirectEnvBySlug[serviceSlug] || `${proto}://${host}/api/integrations/${serviceSlug}/callback`
  );
};

async function handleGoogleDiscover(req: Req, res: ServerResponse) {
  const userId = await resolveAuthorizedUserIdFromRequest(req);
  if (!userId) {
    return sendJson(res, 401, { message: 'Missing authenticated user context.' });
  }

  const discovered: Record<string, string> = {};
  const warnings: string[] = [];

  try {
    const ga4Token = await getValidServiceAccessToken({ userId, service: 'ga4' });
    const ga4Response = await axios.get('https://analyticsadmin.googleapis.com/v1alpha/accountSummaries', {
      params: { pageSize: 200 },
      headers: { Authorization: `Bearer ${ga4Token}` },
    });
    const firstProperty = (ga4Response.data.accountSummaries || [])
      .flatMap((summary: any) => summary.propertySummaries || [])
      .find((property: any) => property?.property);

    if (firstProperty?.property) {
      discovered.ga4PropertyId = String(firstProperty.property).replace('properties/', '');
      if (firstProperty.displayName) {
        discovered.ga4PropertyName = firstProperty.displayName;
      }
    }
  } catch (error) {
    warnings.push(`GA4 discovery failed: ${getErrorMessage(error, 'Unknown GA4 error')}`);
  }

  try {
    const gscToken = await getValidServiceAccessToken({ userId, service: 'search_console' });
    const gscResponse = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${gscToken}` },
    });
    const site = (gscResponse.data.siteEntry || []).find(
      (entry: any) => entry.permissionLevel && entry.permissionLevel !== 'siteUnverified'
    );
    if (site?.siteUrl) discovered.gscSiteUrl = site.siteUrl;
  } catch (error) {
    warnings.push(`Search Console discovery failed: ${getErrorMessage(error, 'Unknown Search Console error')}`);
  }

  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    try {
      const adsToken = await getValidServiceAccessToken({ userId, service: 'google_ads' });
      const adsResponse = await axios.get(
        'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
        {
          headers: {
            Authorization: `Bearer ${adsToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          },
        }
      );
      const firstCustomer = adsResponse.data.resourceNames?.[0];
      if (firstCustomer) {
        discovered.googleAdsId = String(firstCustomer).replace('customers/', '');
      }
    } catch (error) {
      warnings.push(`Google Ads discovery failed: ${getErrorMessage(error, 'Unknown Google Ads error')}`);
    }
  } else {
    warnings.push('Google Ads discovery skipped: GOOGLE_ADS_DEVELOPER_TOKEN is not configured.');
  }

  return sendJson(res, 200, { discovered, warnings });
}

export default async function handler(req: Req, res: ServerResponse) {
  const url = parseUrl(req);
  req.query = parseQuery(url);
  if (req.method === 'POST') {
    req.body = await parseJsonBody(req);
  }

  const segments = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (segments.length < 3 || segments[0] !== 'api' || segments[1] !== 'integrations') {
    return sendJson(res, 404, { message: 'Not found' });
  }

  if (segments[2] === 'google' && segments[3] === 'services') {
    if (req.method !== 'GET') return sendJson(res, 405, { message: 'Method not allowed' });
    const userId = await resolveAuthorizedUserIdFromRequest(req);
    if (!userId) return sendJson(res, 401, { message: 'Missing authenticated user context.' });
    const items = listGoogleServiceConnections(userId).map(toPublicGoogleServicePayload);
    return sendJson(res, 200, { items });
  }

  if (segments[2] === 'google' && segments[3] === 'discover') {
    if (req.method !== 'GET') return sendJson(res, 405, { message: 'Method not allowed' });
    return handleGoogleDiscover(req, res);
  }

  const serviceSlug = segments[2] || '';
  const action = segments[3] || '';
  if (!isServiceSlug(serviceSlug)) {
    return sendJson(res, 404, { message: 'Unsupported integration route' });
  }

  if (action === 'start') {
    if (req.method !== 'GET') return sendJson(res, 405, { message: 'Method not allowed' });
    const userId = await resolveAuthorizedUserIdFromRequest(req);
    if (!userId) return sendJson(res, 401, { message: 'Missing authenticated user context.' });
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return sendJson(res, 500, { message: 'Google OAuth client is not configured' });
    }
    const selectAccount = String(req.query?.select_account || '') === '1';
    const { url: authorizationUrl } = buildGoogleOAuthUrl({
      serviceSlug,
      redirectUri: getRedirectUri(req, serviceSlug),
      userId,
      selectAccount,
    });
    return sendJson(res, 200, { url: authorizationUrl });
  }

  if (action === 'callback') {
    if (req.method !== 'GET') return sendJson(res, 405, { message: 'Method not allowed' });
    const code = String(req.query?.code || '').trim();
    const state = String(req.query?.state || '').trim();
    const serviceKey = googleServiceCatalog.slugToService(serviceSlug);
    if (!code || !state) {
      return sendPopup(res, {
        success: false,
        service: serviceKey,
        error: 'Missing OAuth callback code or state.',
      });
    }
    const consumed = consumeOAuthState(state, serviceSlug);
    if (!consumed?.user_id) {
      return sendPopup(res, {
        success: false,
        service: serviceKey,
        error: 'Invalid or expired OAuth state.',
      });
    }
    try {
      const token = await exchangeCodeForServiceToken({
        code,
        redirectUri: getRedirectUri(req, serviceSlug),
      });
      saveServiceConnection({
        userId: consumed.user_id,
        serviceSlug,
        token,
      });
      return sendPopup(res, { success: true, service: serviceKey });
    } catch (error: any) {
      return sendPopup(res, {
        success: false,
        service: serviceKey,
        error: error?.message || `Failed to authenticate ${serviceSlug}.`,
      });
    }
  }

  if (action === 'disconnect') {
    if (req.method !== 'POST') return sendJson(res, 405, { message: 'Method not allowed' });
    const userId = await resolveAuthorizedUserIdFromRequest(req);
    if (!userId) return sendJson(res, 401, { message: 'Missing authenticated user context.' });
    disconnectServiceConnection({ userId, serviceSlug });
    return sendJson(res, 200, {
      disconnected: true,
      service: googleServiceCatalog.slugToService(serviceSlug),
    });
  }

  if (action === 'access-token') {
    if (req.method !== 'GET') return sendJson(res, 405, { message: 'Method not allowed' });
    const userId = await resolveAuthorizedUserIdFromRequest(req);
    if (!userId) return sendJson(res, 401, { message: 'Missing authenticated user context.' });
    try {
      const accessToken = await getValidServiceAccessToken({
        userId,
        service: googleServiceCatalog.slugToService(serviceSlug),
      });
      return sendJson(res, 200, { accessToken });
    } catch (error: any) {
      return sendJson(res, 400, {
        message:
          error?.message || `${googleServiceCatalog.slugToService(serviceSlug)} service is not connected.`,
      });
    }
  }

  return sendJson(res, 404, { message: 'Unsupported action' });
}
