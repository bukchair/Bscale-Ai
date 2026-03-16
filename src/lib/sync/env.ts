const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const toBool = (value: string | undefined, fallback = false): boolean => {
  if (value == null) return fallback;
  return value === 'true' || value === '1';
};

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
