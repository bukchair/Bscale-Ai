import { prisma } from '@/src/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { googleAdsConnector } from '@/src/lib/sync/connectors/googleAds';
import { metaAdsConnector } from '@/src/lib/sync/connectors/metaAds';
import { tiktokAdsConnector } from '@/src/lib/sync/connectors/tiktokAds';
import { ga4Connector } from '@/src/lib/sync/connectors/ga4';
import { gscConnector } from '@/src/lib/sync/connectors/gsc';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';
import type { SyncMetricsPayload } from '@/src/lib/sync/queue/payloads';
import { syncEnv } from '@/src/lib/sync/env';

const toDecimal = (v: number) => new Prisma.Decimal(v);

/**
 * Ensure a virtual UnifiedCampaign row exists for a non-ad platform (GA4, Search Console)
 * and upsert daily metric rows for it.  We treat each property/site as a single "campaign"
 * so the existing schema can store the time-series without any migration.
 */
async function upsertPropertyMetrics(
  userId: string,
  platform: 'GA4' | 'SEARCH_CONSOLE',
  connectedAccountId: string,
  connectionId: string,
  externalPropertyId: string,
  propertyName: string,
  rows: Array<{ date: string; clicks: number; impressions: number; conversions: number }>
) {
  await prisma.$transaction(async (tx) => {
    // Upsert the virtual "campaign" row for this property/site.
    await tx.unifiedCampaign.upsert({
      where: {
        platform_connectedAccountId_externalCampaignId: {
          platform,
          connectedAccountId,
          externalCampaignId: externalPropertyId,
        },
      },
      create: {
        userId,
        platform,
        connectionId,
        connectedAccountId,
        externalCampaignId: externalPropertyId,
        name: propertyName,
        status: 'ACTIVE',
      },
      update: { name: propertyName },
    });

    const campaign = await tx.unifiedCampaign.findFirstOrThrow({
      where: { userId, platform, connectedAccountId, externalCampaignId: externalPropertyId },
      select: { id: true },
    });

    for (const row of rows) {
      const date = new Date(`${row.date}T00:00:00.000Z`);
      await tx.unifiedCampaignMetricDaily.upsert({
        where: { unifiedCampaignId_date: { unifiedCampaignId: campaign.id, date } },
        create: {
          userId,
          unifiedCampaignId: campaign.id,
          date,
          impressions: row.impressions,
          clicks: row.clicks,
          spend: toDecimal(0),
          conversions: toDecimal(row.conversions),
          revenue: toDecimal(0),
        },
        update: {
          impressions: row.impressions,
          clicks: row.clicks,
          conversions: toDecimal(row.conversions),
        },
      });
    }
  });
}

export const processSyncMetrics = async (payload: SyncMetricsPayload) => {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: payload.connectedAccountId, userId: payload.userId, platformConnectionId: payload.connectionId },
    select: { externalAccountId: true, name: true },
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

  if (payload.platform === 'GA4') {
    const rows = await ga4Connector.fetchSiteMetricsByDay(
      payload.connectionId,
      account.externalAccountId,
      payload.range.startDate,
      payload.range.endDate
    );
    await upsertPropertyMetrics(
      payload.userId,
      'GA4',
      payload.connectedAccountId,
      payload.connectionId,
      account.externalAccountId,
      account.name || `GA4 Property ${account.externalAccountId}`,
      rows.map((row) => ({
        date: row.date,
        clicks: row.activeUsers,
        impressions: row.pageViews,
        conversions: row.conversions,
      }))
    );
    return { synced: rows.length };
  }

  if (payload.platform === 'SEARCH_CONSOLE') {
    const rows = await gscConnector.fetchSearchMetricsByDay(
      payload.connectionId,
      account.externalAccountId,
      payload.range.startDate,
      payload.range.endDate
    );
    await upsertPropertyMetrics(
      payload.userId,
      'SEARCH_CONSOLE',
      payload.connectedAccountId,
      payload.connectionId,
      account.externalAccountId,
      account.name || account.externalAccountId,
      rows.map((row) => ({
        date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        conversions: 0,
      }))
    );
    return { synced: rows.length };
  }

  return { synced: 0, skipped: true, reason: `Platform ${payload.platform} has no metrics sync.` };
};
