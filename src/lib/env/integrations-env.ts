const DEFAULT_APP_BASE_URL = 'http://localhost:3000';
const DEFAULT_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
const DEFAULT_SESSION_SECRET = 'local-dev-session-secret-change-me-12345';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// NEXT_PHASE is set to 'phase-production-build' during `next build`.
// Env vars that are only available at runtime (e.g. secrets) must not be
// validated at build time, otherwise the build fails even when the vars ARE
// correctly set in the deployment environment.
const IS_NEXT_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

if (IS_PRODUCTION && !IS_NEXT_BUILD) {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('[integrations-env] ENCRYPTION_KEY must be set in production.');
  }
  if (
    !process.env.SESSION_SIGNING_SECRET ||
    process.env.SESSION_SIGNING_SECRET.length < 32
  ) {
    throw new Error(
      '[integrations-env] SESSION_SIGNING_SECRET must be at least 32 characters in production.'
    );
  }
} else if (process.env.NODE_ENV !== 'test' && !IS_NEXT_BUILD) {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn(
      '[integrations-env] ENCRYPTION_KEY is not set. Using insecure default — set this variable before going to production.'
    );
  }
  if (
    !process.env.SESSION_SIGNING_SECRET ||
    process.env.SESSION_SIGNING_SECRET.length < 32
  ) {
    console.warn(
      '[integrations-env] SESSION_SIGNING_SECRET is weak or missing. Set a strong secret before going to production.'
    );
  }
}

const toBoolean = (value: string | undefined): boolean => value === 'true';

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const toUrl = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return value;
  } catch {
    return fallback;
  }
};

const toBase64Key = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  try {
    return Buffer.from(value, 'base64').length === 32 ? value : fallback;
  } catch {
    return fallback;
  }
};

const appBaseUrl = toUrl(process.env.APP_BASE_URL, DEFAULT_APP_BASE_URL);

export const integrationsEnv = {
  NODE_ENV:
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
      ? process.env.NODE_ENV
      : 'development',
  APP_BASE_URL: appBaseUrl,
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  ENCRYPTION_KEY: toBase64Key(process.env.ENCRYPTION_KEY, DEFAULT_ENCRYPTION_KEY),
  SESSION_SIGNING_SECRET:
    process.env.SESSION_SIGNING_SECRET && process.env.SESSION_SIGNING_SECRET.length >= 32
      ? process.env.SESSION_SIGNING_SECRET
      : DEFAULT_SESSION_SECRET,
  OAUTH_STATE_TTL_SECONDS: toPositiveInt(process.env.OAUTH_STATE_TTL_SECONDS, 600),
  ENABLE_GMAIL_SEND_SCOPE: toBoolean(process.env.ENABLE_GMAIL_SEND_SCOPE),
  TIKTOK_REPORTING_ENABLED: toBoolean(process.env.TIKTOK_REPORTING_ENABLED),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_REDIRECT_URI: toUrl(
    process.env.GOOGLE_REDIRECT_URI,
    `${appBaseUrl}/api/connections/google-ads/callback`
  ),
  GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
  GOOGLE_ADS_MANAGER_CUSTOMER_ID: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
  META_APP_ID: process.env.META_APP_ID ?? '',
  META_APP_SECRET: process.env.META_APP_SECRET ?? '',
  META_REDIRECT_URI: toUrl(process.env.META_REDIRECT_URI, `${appBaseUrl}/api/connections/meta/callback`),
  TIKTOK_APP_ID: process.env.TIKTOK_APP_ID ?? '',
  TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY ?? '',
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET ?? '',
  TIKTOK_REDIRECT_URI: toUrl(
    process.env.TIKTOK_REDIRECT_URI,
    `${appBaseUrl}/api/connections/tiktok/callback`
  ),
} as const;
