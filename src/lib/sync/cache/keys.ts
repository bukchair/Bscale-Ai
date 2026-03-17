const PREFIX = 'bscale:v1';

export const cacheKeys = {
  unifiedOverview: (userId: string, start: string, end: string) =>
    `${PREFIX}:overview:${userId}:${start}:${end}`,
  unifiedCampaigns: (
    userId: string,
    platform: string,
    accountId: string,
    cursor: string,
    take: number,
    queryHash: string
  ) => `${PREFIX}:campaigns:${userId}:${platform}:${accountId}:${cursor}:${take}:${queryHash}`,
  unifiedMetrics: (userId: string, start: string, end: string, platform: string, campaignId: string) =>
    `${PREFIX}:metrics:${userId}:${platform}:${campaignId}:${start}:${end}`,
};
