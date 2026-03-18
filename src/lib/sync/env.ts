const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const toBool = (value: string | undefined, fallback = false): boolean => {
  if (value == null) return fallback;
  return value === 'true' || value === '1';
};

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_NEXT_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

if (IS_PRODUCTION && !IS_NEXT_BUILD) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) {
    throw new Error(
      '[sync-env] CRON_SECRET must be set and at least 32 characters in production.'
    );
  }
} else if (process.env.NODE_ENV !== 'test' && !IS_NEXT_BUILD) {
  if (!process.env.CRON_SECRET) {
    console.warn(
      '[sync-env] CRON_SECRET is not set. Cron endpoints will reject all requests. Set this variable before deploying.'
    );
  } else if (process.env.CRON_SECRET.length < 32) {
    console.warn(
      '[sync-env] CRON_SECRET is too short (< 32 chars). Use a strong random secret in production.'
    );
  }
}

export const syncEnv = {
  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_HOST: process.env.REDIS_HOST || '',
  REDIS_PORT: toInt(process.env.REDIS_PORT, 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_TLS: toBool(process.env.REDIS_TLS, false),
  CRON_SECRET: process.env.CRON_SECRET || '',
  WORKER_INSTANCE_ID: process.env.WORKER_INSTANCE_ID || 'local-worker',
  SYNC_METRICS_DEFAULT_LOOKBACK_DAYS: toInt(process.env.SYNC_METRICS_DEFAULT_LOOKBACK_DAYS, 30),
  SYNC_HOURLY_LOOKBACK_HOURS: toInt(process.env.SYNC_HOURLY_LOOKBACK_HOURS, 48),
  TIKTOK_SYNC_ENABLED: toBool(process.env.TIKTOK_SYNC_ENABLED, false),
} as const;
