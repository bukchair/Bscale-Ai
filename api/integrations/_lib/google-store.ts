import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import Database from 'better-sqlite3';

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

const getDbPath = () => {
  const configuredPath = process.env.GOOGLE_INTEGRATIONS_DB_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }
  return path.join(process.cwd(), '.data', 'google-integrations.db');
};

let dbSingleton: Database.Database | null = null;

const getDb = () => {
  if (dbSingleton) return dbSingleton;
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS google_oauth_states (
      state TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service_slug TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_connections (
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      service TEXT NOT NULL,
      status TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry INTEGER,
      scope TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, provider, service)
    );
  `);
  dbSingleton = db;
  return dbSingleton;
};

const nowMs = () => Date.now();

const upsertConnectionStmt = () =>
  getDb().prepare(`
    INSERT INTO integration_connections (
      user_id, provider, service, status, access_token, refresh_token, token_expiry, scope, created_at, updated_at
    ) VALUES (
      @user_id, 'google', @service, @status, @access_token, @refresh_token, @token_expiry, @scope, @created_at, @updated_at
    )
    ON CONFLICT(user_id, provider, service) DO UPDATE SET
      status = excluded.status,
      access_token = excluded.access_token,
      refresh_token = CASE
        WHEN excluded.refresh_token IS NOT NULL AND excluded.refresh_token <> '' THEN excluded.refresh_token
        ELSE integration_connections.refresh_token
      END,
      token_expiry = excluded.token_expiry,
      scope = excluded.scope,
      updated_at = excluded.updated_at
  `);

const sanitizeUserId = (value: unknown) => {
  const str = typeof value === 'string' ? value.trim() : '';
  return str;
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
  if (value in SERVICE_SCOPE_BY_SLUG) {
    return value as GoogleServiceSlug;
  }
  return null;
};

export const resolveUserIdFromRequest = (req: { query?: any; headers?: any; body?: any }): string => {
  const fromQuery = sanitizeUserId(req.query?.user_id);
  if (fromQuery) return fromQuery;
  const fromHeaders = sanitizeUserId(req.headers?.['x-user-id']);
  if (fromHeaders) return fromHeaders;
  const fromBody = sanitizeUserId(req.body?.user_id);
  return fromBody;
};

export const buildGoogleOAuthUrl = (args: {
  serviceSlug: GoogleServiceSlug;
  redirectUri: string;
  userId: string;
  selectAccount?: boolean;
}) => {
  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = nowMs() + 10 * 60 * 1000;

  getDb()
    .prepare(
      `
      INSERT INTO google_oauth_states (state, user_id, service_slug, expires_at)
      VALUES (?, ?, ?, ?)
    `
    )
    .run(state, args.userId, args.serviceSlug, expiresAt);

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
  const row = getDb()
    .prepare(
      `
      SELECT state, user_id, service_slug, expires_at
      FROM google_oauth_states
      WHERE state = ?
      LIMIT 1
    `
    )
    .get(state) as OAuthStateRow | undefined;

  if (!row) return null;
  getDb().prepare(`DELETE FROM google_oauth_states WHERE state = ?`).run(state);

  if (row.service_slug !== serviceSlug) return null;
  if (row.expires_at < nowMs()) return null;
  return row;
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
  const tokenExpiry = issuedAt + expiresIn * 1000;

  upsertConnectionStmt().run({
    user_id: args.userId,
    service,
    status: 'connected',
    access_token: args.token.access_token || null,
    refresh_token: args.token.refresh_token || null,
    token_expiry: tokenExpiry,
    scope: args.token.scope || googleServiceCatalog.scopeForSlug(args.serviceSlug),
    created_at: issuedAt,
    updated_at: issuedAt,
  });
};

export const disconnectServiceConnection = (args: { userId: string; serviceSlug: GoogleServiceSlug }) => {
  const service = googleServiceCatalog.slugToService(args.serviceSlug);
  const at = nowMs();
  upsertConnectionStmt().run({
    user_id: args.userId,
    service,
    status: 'disconnected',
    access_token: null,
    refresh_token: null,
    token_expiry: null,
    scope: null,
    created_at: at,
    updated_at: at,
  });
};

export const listGoogleServiceConnections = (userId: string): GoogleConnectionRow[] => {
  const rows = getDb()
    .prepare(
      `
      SELECT user_id, provider, service, status, access_token, refresh_token, token_expiry, scope, updated_at
      FROM integration_connections
      WHERE user_id = ? AND provider = 'google'
    `
    )
    .all(userId) as GoogleConnectionRow[];

  const existingByService = new Map(rows.map((row) => [row.service, row]));
  return (['google_ads', 'ga4', 'search_console', 'gmail'] as GoogleServiceKey[]).map((service) => {
    const existing = existingByService.get(service);
    if (existing) return existing;
    return {
      user_id: userId,
      provider: 'google',
      service,
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      token_expiry: null,
      scope: null,
      updated_at: 0,
    };
  });
};

export const getServiceConnection = (args: {
  userId: string;
  service: GoogleServiceKey;
}): GoogleConnectionRow | null => {
  const row = getDb()
    .prepare(
      `
      SELECT user_id, provider, service, status, access_token, refresh_token, token_expiry, scope, updated_at
      FROM integration_connections
      WHERE user_id = ? AND provider = 'google' AND service = ?
      LIMIT 1
    `
    )
    .get(args.userId, args.service) as GoogleConnectionRow | undefined;

  return row || null;
};

export const getValidServiceAccessToken = async (args: {
  userId: string;
  service: GoogleServiceKey;
}): Promise<string> => {
  const row = getServiceConnection(args);
  if (!row || row.status !== 'connected') {
    throw new Error(`Google service ${args.service} is not connected.`);
  }

  const accessToken = row.access_token || '';
  const refreshTokenValue = row.refresh_token || '';
  const expiry = Number(row.token_expiry || 0);
  const isAccessStillValid = Boolean(accessToken && expiry > nowMs() + 60_000);
  if (isAccessStillValid) return accessToken;

  if (!refreshTokenValue) {
    throw new Error(`Google service ${args.service} token expired and no refresh token is available.`);
  }

  const refreshed = await refreshAccessToken(refreshTokenValue);
  const issuedAt = nowMs();
  const refreshedExpiry = issuedAt + Math.max(30, Number(refreshed.expires_in || 3600)) * 1000;

  upsertConnectionStmt().run({
    user_id: args.userId,
    service: args.service,
    status: 'connected',
    access_token: refreshed.access_token || null,
    refresh_token: refreshed.refresh_token || null,
    token_expiry: refreshedExpiry,
    scope: refreshed.scope || row.scope || null,
    created_at: issuedAt,
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
export default function _libGoogleStoreHandler(_req: unknown, res: { statusCode?: number; end: (body?: string) => void }) {
  res.statusCode = 404;
  res.end('Not Found');
}
