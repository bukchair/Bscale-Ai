import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db/prisma';
import { toPrismaJson } from '@/src/lib/integrations/utils/prisma-json';
import type { UnifiedDataLayer } from '@/src/lib/unified-data/types';

const toDecimal = (value: number | undefined | null) => new Prisma.Decimal(Number(value || 0));

export const unifiedRepo = {
  async upsertLayer(userId: string, layer: UnifiedDataLayer) {
    await prisma.$transaction(async (tx) => {
      for (const campaign of layer.campaigns) {
        const accountExternalId = campaign.accountId.split(':').pop() || '';
        const account = await tx.connectedAccount.findFirst({
          where: {
            userId,
            platform: campaign.platform === 'Google' ? 'GOOGLE_ADS' : campaign.platform.toUpperCase() as any,
            externalAccountId: accountExternalId,
          },
          select: {
            id: true,
            platformConnectionId: true,
          },
        });
        if (!account) continue;

        await tx.unifiedCampaign.upsert({
          where: {
            platform_connectedAccountId_externalCampaignId: {
              platform: campaign.platform === 'Google' ? 'GOOGLE_ADS' : campaign.platform.toUpperCase() as any,
              connectedAccountId: account.id,
              externalCampaignId: campaign.externalId,
            },
          },
          create: {
            userId,
            platform: campaign.platform === 'Google' ? 'GOOGLE_ADS' : campaign.platform.toUpperCase() as any,
            connectionId: account.platformConnectionId,
            connectedAccountId: account.id,
            externalCampaignId: campaign.externalId,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective || null,
            currency: undefined,
            timezone: undefined,
            raw: campaign.providerData ? toPrismaJson(campaign.providerData) : undefined,
          },
          update: {
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective || null,
            raw: campaign.providerData ? toPrismaJson(campaign.providerData) : undefined,
          },
        });
      }

      for (const metric of layer.metrics) {
        if (metric.entityType !== 'campaign') continue;
        const externalCampaignId = metric.entityId.split(':').pop() || '';
        const platform = metric.platform === 'Google' ? 'GOOGLE_ADS' : metric.platform.toUpperCase();
        const campaign = await tx.unifiedCampaign.findFirst({
          where: {
            userId,
            platform: platform as any,
            externalCampaignId,
          },
          select: { id: true },
        });
        if (!campaign) continue;

        const dateIso = metric.dateRange?.endDate || metric.dateRange?.startDate || new Date().toISOString().slice(0, 10);
        const date = new Date(`${dateIso}T00:00:00.000Z`);
        await tx.unifiedCampaignMetricDaily.upsert({
          where: {
            unifiedCampaignId_date: {
              unifiedCampaignId: campaign.id,
              date,
            },
          },
          create: {
            userId,
            unifiedCampaignId: campaign.id,
            date,
            impressions: Math.round(metric.impressions || 0),
            clicks: Math.round(metric.clicks || 0),
            spend: toDecimal(metric.spend),
            conversions: toDecimal((metric as any).conversions || 0),
            revenue: toDecimal((metric as any).conversionValue || 0),
            raw: toPrismaJson(metric as unknown as Record<string, unknown>),
          },
          update: {
            impressions: Math.round(metric.impressions || 0),
            clicks: Math.round(metric.clicks || 0),
            spend: toDecimal(metric.spend),
            conversions: toDecimal((metric as any).conversions || 0),
            revenue: toDecimal((metric as any).conversionValue || 0),
            raw: toPrismaJson(metric as unknown as Record<string, unknown>),
          },
        });
      }
    });
  },

  async buildDailySnapshot(userId: string, dayIso: string) {
    const date = new Date(`${dayIso}T00:00:00.000Z`);
    const rows = await prisma.unifiedCampaignMetricDaily.findMany({
      where: {
        userId,
        date,
      },
      select: {
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
        revenue: true,
      },
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.totalImpressions += row.impressions;
        acc.totalClicks += row.clicks;
        acc.totalSpend += Number(row.spend || 0);
        acc.totalConversions += Number(row.conversions || 0);
        acc.totalRevenue += Number(row.revenue || 0);
        return acc;
      },
      {
        totalImpressions: 0,
        totalClicks: 0,
        totalSpend: 0,
        totalConversions: 0,
        totalRevenue: 0,
      }
    );

    return prisma.unifiedSnapshotDaily.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      create: {
        userId,
        date,
        totalSpend: toDecimal(totals.totalSpend),
        totalRevenue: toDecimal(totals.totalRevenue),
        totalConversions: toDecimal(totals.totalConversions),
        totalClicks: totals.totalClicks,
        totalImpressions: totals.totalImpressions,
        raw: toPrismaJson(totals as unknown as Record<string, unknown>),
      },
      update: {
        totalSpend: toDecimal(totals.totalSpend),
        totalRevenue: toDecimal(totals.totalRevenue),
        totalConversions: toDecimal(totals.totalConversions),
        totalClicks: totals.totalClicks,
        totalImpressions: totals.totalImpressions,
        raw: toPrismaJson(totals as unknown as Record<string, unknown>),
      },
    });
  },

  async upsertDailyMetricsByExternalCampaign(
    userId: string,
    platform: 'GOOGLE_ADS' | 'META' | 'TIKTOK',
    rows: Array<{
      campaignExternalId: string;
      date: string;
      impressions: number;
      clicks: number;
      spend: number;
      conversions: number;
      revenue: number;
      raw?: Record<string, unknown>;
    }>
  ) {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const campaign = await tx.unifiedCampaign.findFirst({
          where: {
            userId,
            platform,
            externalCampaignId: row.campaignExternalId,
          },
          select: { id: true },
        });
        if (!campaign) continue;
        const date = new Date(`${row.date}T00:00:00.000Z`);
        await tx.unifiedCampaignMetricDaily.upsert({
          where: {
            unifiedCampaignId_date: {
              unifiedCampaignId: campaign.id,
              date,
            },
          },
          create: {
            userId,
            unifiedCampaignId: campaign.id,
            date,
            impressions: Math.round(row.impressions || 0),
            clicks: Math.round(row.clicks || 0),
            spend: toDecimal(row.spend),
            conversions: toDecimal(row.conversions),
            revenue: toDecimal(row.revenue),
            raw: row.raw ? toPrismaJson(row.raw) : undefined,
          },
          update: {
            impressions: Math.round(row.impressions || 0),
            clicks: Math.round(row.clicks || 0),
            spend: toDecimal(row.spend),
            conversions: toDecimal(row.conversions),
            revenue: toDecimal(row.revenue),
            raw: row.raw ? toPrismaJson(row.raw) : undefined,
          },
        });
      }
    });
  },
};
