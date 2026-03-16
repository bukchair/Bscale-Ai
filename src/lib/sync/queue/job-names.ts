export const JOBS = {
  REFRESH_TOKENS: 'refreshTokens',
  SYNC_ACCOUNTS: 'syncAccounts',
  SYNC_CAMPAIGNS: 'syncCampaigns',
  SYNC_METRICS: 'syncMetrics',
  SNAPSHOT_DAILY: 'snapshotDaily',
  ACTION: 'action',
} as const;

export type SyncJobName = (typeof JOBS)[keyof typeof JOBS];
