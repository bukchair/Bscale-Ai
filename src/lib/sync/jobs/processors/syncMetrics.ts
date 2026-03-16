import { prisma } from '@/src/lib/db/prisma';
import { googleAdsConnector } from '@/src/lib/sync/connectors/googleAds';
import { metaAdsConnector } from '@/src/lib/sync/connectors/metaAds';
import { tiktokAdsConnector } from '@/src/lib/sync/connectors/tiktokAds';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';
import type { SyncMetricsPayload } from '@/src/lib/sync/queue/payloads';
import { syncEnv } from '@/src/lib/sync/env';

export const processSyncMetrics = async (payload: SyncMetricsPayload) => {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: payload.connectedAccountId, userId: payload.userId, platformConnectionId: payload.connectionId },
    select: { externalAccountId: true },
  });
  if (!account) {
    return { synced: 0, skipped: true, reason: 'Connected account not found.' };
  }

  if (payload.platform === 'GOOGLE_ADS') {
    const rows = await googleAdsConnector.fetchCampaignMetricsByDay(
      payload.connectionId,
      account.externalAccountId.replace(/\D/g, ''),
      payload.range.startDate,
      payload.range.endDate
    );
    await unifiedRepo.upsertDailyMetricsByExternalCampaign(
      payload.userId,
      'GOOGLE_ADS',
      rows.map((row) => ({
        campaignExternalId: row.campaignId,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: row.spend,
        conversions: row.conversions,
        revenue: row.revenue,
        raw: row,
      }))
    );
    return { synced: rows.length };
  }

  if (payload.platform === 'META') {
    const rows = await metaAdsConnector.fetchCampaignMetricsByDay(
      payload.connectionId,
      account.externalAccountId,
      payload.range.startDate,
      payload.range.endDate
    );
    await unifiedRepo.upsertDailyMetricsByExternalCampaign(
      payload.userId,
      'META',
      rows.map((row) => ({
        campaignExternalId: row.campaignId,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: row.spend,
        conversions: row.conversions,
        revenue: row.revenue,
        raw: row,
      }))
    );
    return { synced: rows.length };
  }

  if (payload.platform === 'TIKTOK') {
    if (!syncEnv.TIKTOK_SYNC_ENABLED) {
      return { synced: 0, skipped: true, reason: 'TIKTOK_SYNC_ENABLED=false' };
    }
    const rows = await tiktokAdsConnector.fetchCampaignMetricsByDay(
      payload.connectionId,
      account.externalAccountId,
      payload.range.startDate,
      payload.range.endDate
    );
    await unifiedRepo.upsertDailyMetricsByExternalCampaign(
      payload.userId,
      'TIKTOK',
      rows.map((row) => ({
        campaignExternalId: row.campaignId,
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: row.spend,
        conversions: row.conversions,
        revenue: row.revenue,
        raw: row,
      }))
    );
    return { synced: rows.length };
  }

  return { synced: 0, skipped: true, reason: `Platform ${payload.platform} has no metrics sync.` };
};
