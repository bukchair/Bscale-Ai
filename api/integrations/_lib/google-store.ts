import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';

export type GoogleServiceSlug = 'google-ads' | 'ga4' | 'search-console' | 'gmail';
export type GoogleServiceKey = 'google_ads' | 'ga4' | 'search_console' | 'gmail';
export type GoogleServiceStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

type OAuthStateRow = {
  state: string;
  user_id: string;
  service_slug: GoogleServiceSlug;
  expires_at: number;
};

type GoogleConnectionRow = {
  user_id: string;
  provider: 'google';
  service: GoogleServiceKey;
  status: GoogleServiceStatus;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: number | null;
  scope: string | null;
  updated_at: number;
};

type ExchangeTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type StoreSchema = {
  oauthStates: OAuthStateRow[];
  connections: GoogleConnectionRow[];
};

const SERVICE_SCOPE_BY_SLUG: Record<GoogleServiceSlug, string> = {
  'google-ads': 'https://www.googleapis.com/auth/adwords',
  ga4: 'https://www.googleapis.com/auth/analytics.readonly',
  'search-console': 'https://www.googleapis.com/auth/webmasters.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.send',
};

const SERVICE_KEY_BY_SLUG: Record<GoogleServiceSlug, GoogleServiceKey> = {
  'google-ads': 'google_ads',
  ga4: 'ga4',
  'search-console': 'search_console',
  gmail: 'gmail',
};

const SERVICE_SLUG_BY_KEY: Record<GoogleServiceKey, GoogleServiceSlug> = {
  google_ads: 'google-ads',
  ga4: 'ga4',
  search_console: 'search-console',
  gmail: 'gmail',
};

const getStorePath = () => {
  const configuredPath = process.env.GOOGLE_INTEGRATIONS_DB_PATH?.trim();
  const fallback = '.data/google-integrations-store.json';
  const relativePath = configuredPath || fallback;
  return path.isAbsolute(relativePath) ? relativePath : path.join(process.cwd(), relativePath);
};

const nowMs = () => Date.now();

const ensureStoreFile = () => {
  const storePath = getStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  if (!fs.existsSync(storePath)) {
    const seed: StoreSchema = { oauthStates: [], connections: [] };
    fs.writeFileSync(storePath, JSON.stringify(seed), 'utf8');
  }
};

const readStore = (): StoreSchema => {
  ensureStoreFile();
  const raw = fs.readFileSync(getStorePath(), 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<StoreSchema>;
    return {
      oauthStates: Array.isArray(parsed.oauthStates) ? parsed.oauthStates : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    };
  } catch {
    return { oauthStates: [], connections: [] };
  }
};

const writeStore = (next: StoreSchema) => {
  ensureStoreFile();
  fs.writeFileSync(getStorePath(), JSON.stringify(next), 'utf8');
};

const sanitizeUserId = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const refreshAccessToken = async (refreshToken: string): Promise<ExchangeTokenResponse> => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials are missing.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await axios.post<ExchangeTokenResponse>(
    'https://oauth2.googleapis.com/token',
    body.toString(),
    { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
  );

  return response.data;
};

const upsertConnection = (input: Omit<GoogleConnectionRow, 'provider'> & { provider?: 'google' }) => {
  const store = readStore();
  const idx = store.connections.findIndex(
    (row) => row.user_id === input.user_id && row.service === input.service
  );
  const row: GoogleConnectionRow = {
    provider: 'google',
    user_id: input.user_id,
    service: input.service,
    status: input.status,
    access_token: input.access_token,
    refresh_token: input.refresh_token,
    token_expiry: input.token_expiry,
    scope: input.scope,
    updated_at: input.updated_at,
  };

  if (idx >= 0) {
    const previous = store.connections[idx];
    // Keep existing refresh token if new payload does not include one.
    row.refresh_token =
      row.refresh_token && row.refresh_token.trim()
        ? row.refresh_token
        : previous.refresh_token || null;
    store.connections[idx] = row;
  } else {
    store.connections.push(row);
  }

  writeStore(store);
};

export const googleServiceCatalog = {
  allSlugs(): GoogleServiceSlug[] {
    return ['google-ads', 'ga4', 'search-console', 'gmail'];
  },
  slugToService(slug: GoogleServiceSlug): GoogleServiceKey {
    return SERVICE_KEY_BY_SLUG[slug];
  },
  serviceToSlug(service: GoogleServiceKey): GoogleServiceSlug {
    return SERVICE_SLUG_BY_KEY[service];
  },
  scopeForSlug(slug: GoogleServiceSlug): string {
    return SERVICE_SCOPE_BY_SLUG[slug];
  },
};

export const resolveGoogleServiceSlug = (value: string): GoogleServiceSlug | null => {
  if (value in SERVICE_SCOPE_BY_SLUG) return value as GoogleServiceSlug;
  return null;
};

export const resolveUserIdFromRequest = (req: { query?: any; headers?: any; body?: any }): string => {
  const fromQuery = sanitizeUserId(req.query?.user_id);
  if (fromQuery) return fromQuery;
  const fromHeader = sanitizeUserId(req.headers?.['x-user-id']);
  if (fromHeader) return fromHeader;
  return sanitizeUserId(req.body?.user_id);
};

export const buildGoogleOAuthUrl = (args: {
  serviceSlug: GoogleServiceSlug;
  redirectUri: string;
  userId: string;
  selectAccount?: boolean;
}) => {
  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = nowMs() + 10 * 60 * 1000;
  const store = readStore();
  store.oauthStates = store.oauthStates.filter((item) => item.expires_at > nowMs());
  store.oauthStates.push({
    state,
    user_id: args.userId,
    service_slug: args.serviceSlug,
    expires_at: expiresAt,
  });
  writeStore(store);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: googleServiceCatalog.scopeForSlug(args.serviceSlug),
    access_type: 'offline',
    include_granted_scopes: 'false',
    state,
    prompt: args.selectAccount ? 'select_account consent' : 'consent',
  });

  return {
    state,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  };
};

export const consumeOAuthState = (state: string, serviceSlug: GoogleServiceSlug): OAuthStateRow | null => {
  const store = readStore();
  const found = store.oauthStates.find((item) => item.state === state) || null;
  store.oauthStates = store.oauthStates.filter((item) => item.state !== state);
  writeStore(store);
  if (!found) return null;
  if (found.service_slug !== serviceSlug) return null;
  if (found.expires_at < nowMs()) return null;
  return found;
};

export const exchangeCodeForServiceToken = async (args: {
  code: string;
  redirectUri: string;
}): Promise<ExchangeTokenResponse> => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials are missing.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: 'authorization_code',
    code: args.code,
  });

  const response = await axios.post<ExchangeTokenResponse>(
    'https://oauth2.googleapis.com/token',
    body.toString(),
    { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
  );

  return response.data;
};

export const saveServiceConnection = (args: {
  userId: string;
  serviceSlug: GoogleServiceSlug;
  token: ExchangeTokenResponse;
}) => {
  const service = googleServiceCatalog.slugToService(args.serviceSlug);
  const issuedAt = nowMs();
  const expiresIn = Math.max(30, Number(args.token.expires_in || 3600));
  upsertConnection({
    user_id: args.userId,
    service,
    status: 'connected',
    access_token: args.token.access_token || null,
    refresh_token: args.token.refresh_token || null,
    token_expiry: issuedAt + expiresIn * 1000,
    scope: args.token.scope || googleServiceCatalog.scopeForSlug(args.serviceSlug),
    updated_at: issuedAt,
  });
};

export const disconnectServiceConnection = (args: { userId: string; serviceSlug: GoogleServiceSlug }) => {
  const at = nowMs();
  upsertConnection({
    user_id: args.userId,
    service: googleServiceCatalog.slugToService(args.serviceSlug),
    status: 'disconnected',
    access_token: null,
    refresh_token: null,
    token_expiry: null,
    scope: null,
    updated_at: at,
  });
};

export const listGoogleServiceConnections = (userId: string): GoogleConnectionRow[] => {
  const store = readStore();
  const rows = store.connections.filter(
    (item) => item.user_id === userId && item.provider === 'google'
  );
  const byService = new Map(rows.map((item) => [item.service, item]));

  return (['google_ads', 'ga4', 'search_console', 'gmail'] as GoogleServiceKey[]).map((service) => {
    return (
      byService.get(service) || {
        user_id: userId,
        provider: 'google',
        service,
        status: 'disconnected',
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        scope: null,
        updated_at: 0,
      }
    );
  });
};

export const getServiceConnection = (args: {
  userId: string;
  service: GoogleServiceKey;
}): GoogleConnectionRow | null => {
  const store = readStore();
  return (
    store.connections.find(
      (row) => row.user_id === args.userId && row.provider === 'google' && row.service === args.service
    ) || null
  );
};

export const getValidServiceAccessToken = async (args: {
  userId: string;
  service: GoogleServiceKey;
}): Promise<string> => {
  const row = getServiceConnection(args);
  if (!row || row.status !== 'connected') {
    throw new Error(`Google service ${args.service} is not connected.`);
  }

  if (row.access_token && Number(row.token_expiry || 0) > nowMs() + 60_000) {
    return row.access_token;
  }

  if (!row.refresh_token) {
    throw new Error(`Google service ${args.service} token expired and no refresh token is available.`);
  }

  const refreshed = await refreshAccessToken(row.refresh_token);
  const issuedAt = nowMs();
  const nextExpiry = issuedAt + Math.max(30, Number(refreshed.expires_in || 3600)) * 1000;
  upsertConnection({
    user_id: args.userId,
    service: args.service,
    status: 'connected',
    access_token: refreshed.access_token || null,
    refresh_token: refreshed.refresh_token || null,
    token_expiry: nextExpiry,
    scope: refreshed.scope || row.scope || null,
    updated_at: issuedAt,
  });

  if (!refreshed.access_token) {
    throw new Error(`Google service ${args.service} refresh did not return access token.`);
  }
  return refreshed.access_token;
};

export const toPublicGoogleServicePayload = (row: GoogleConnectionRow) => ({
  provider: 'google' as const,
  service: row.service,
  serviceSlug: googleServiceCatalog.serviceToSlug(row.service),
  status: row.status,
  tokenExpiry: row.token_expiry,
  scope: row.scope,
  updatedAt: row.updated_at,
});

// Prevent Vercel API route build errors if this helper file is scanned as a function.
export default function _libGoogleStoreHandler(
  _req: unknown,
  res: { statusCode?: number; end: (body?: string) => void }
) {
  res.statusCode = 404;
  res.end('Not Found');
}
