import { Platform, Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db/prisma';
import { toPrismaJson } from '@/src/lib/integrations/utils/prisma-json';
import type { UnifiedDataLayer, UnifiedMetricSnapshot } from '@/src/lib/unified-data/types';

const toDecimal = (value: number | undefined | null) => new Prisma.Decimal(Number(value || 0));

const PLATFORM_MAP: Record<string, Platform> = {
  Google: Platform.GOOGLE_ADS,
  Meta: Platform.META,
  TikTok: Platform.TIKTOK,
  GA4: Platform.GA4,
  SearchConsole: Platform.SEARCH_CONSOLE,
};

const toPlatformEnum = (platform: string): Platform =>
  PLATFORM_MAP[platform] ?? (platform.toUpperCase() as Platform);

type MetricWithConversions = UnifiedMetricSnapshot & {
  conversions?: number;
  conversionValue?: number;
};

export const unifiedRepo = {
  async upsertLayer(userId: string, layer: UnifiedDataLayer) {
    await prisma.$transaction(async (tx) => {
      for (const campaign of layer.campaigns) {
        const accountExternalId = campaign.accountId.split(':').pop() || '';
        const account = await tx.connectedAccount.findFirst({
          where: {
            userId,
            platform: toPlatformEnum(campaign.platform),
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
              platform: toPlatformEnum(campaign.platform),
              connectedAccountId: account.id,
              externalCampaignId: campaign.externalId,
            },
          },
          create: {
            userId,
            platform: toPlatformEnum(campaign.platform),
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
        const platform = toPlatformEnum(metric.platform);
        const campaign = await tx.unifiedCampaign.findFirst({
          where: {
            userId,
            platform,
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
            conversions: toDecimal((metric as MetricWithConversions).conversions || 0),
            revenue: toDecimal((metric as MetricWithConversions).conversionValue || 0),
            raw: toPrismaJson(metric as unknown as Record<string, unknown>),
          },
          update: {
            impressions: Math.round(metric.impressions || 0),
            clicks: Math.round(metric.clicks || 0),
            spend: toDecimal(metric.spend),
            conversions: toDecimal((metric as MetricWithConversions).conversions || 0),
            revenue: toDecimal((metric as MetricWithConversions).conversionValue || 0),
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

  /** Aggregate totals + per-day breakdown for a user across all platforms. */
  async getOverview(userId: string, startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    const rows = await prisma.unifiedCampaignMetricDaily.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { date: true, impressions: true, clicks: true, spend: true, conversions: true, revenue: true },
      orderBy: { date: 'asc' },
    });

    const totals = { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 };
    const byDayMap = new Map<string, typeof totals>();

    for (const row of rows) {
      const d = row.date.toISOString().slice(0, 10);
      const day = byDayMap.get(d) ?? { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 };
      day.spend += Number(row.spend);
      day.revenue += Number(row.revenue);
      day.conversions += Number(row.conversions);
      day.clicks += row.clicks;
      day.impressions += row.impressions;
      byDayMap.set(d, day);
      totals.spend += Number(row.spend);
      totals.revenue += Number(row.revenue);
      totals.conversions += Number(row.conversions);
      totals.clicks += row.clicks;
      totals.impressions += row.impressions;
    }

    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    return {
      start: startDate,
      end: endDate,
      totals: { ...totals, roas: Math.round(roas * 100) / 100 },
      byDay: Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v })),
    };
  },

  /** Paginated list of campaigns with aggregated metrics for a date range. */
  async getCampaigns(
    userId: string,
    options: {
      platform?: string;
      startDate?: string;
      endDate?: string;
      cursor?: string;
      take?: number;
    }
  ) {
    const take = Math.min(options.take ?? 50, 200);
    const campaigns = await prisma.unifiedCampaign.findMany({
      where: {
        userId,
        ...(options.platform ? { platform: toPlatformEnum(options.platform) } : {}),
      },
      select: {
        id: true,
        platform: true,
        name: true,
        status: true,
        objective: true,
        externalCampaignId: true,
        connectedAccountId: true,
        metricsDaily: options.startDate && options.endDate
          ? {
              where: {
                date: {
                  gte: new Date(`${options.startDate}T00:00:00.000Z`),
                  lte: new Date(`${options.endDate}T00:00:00.000Z`),
                },
              },
              select: { spend: true, revenue: true, conversions: true, clicks: true, impressions: true },
            }
          : { select: { spend: true, revenue: true, conversions: true, clicks: true, impressions: true }, take: 90 },
      },
      orderBy: { name: 'asc' },
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    const hasMore = campaigns.length > take;
    const page = hasMore ? campaigns.slice(0, take) : campaigns;

    return {
      data: page.map((c) => {
        const agg = c.metricsDaily.reduce(
          (acc: { spend: number; revenue: number; conversions: number; clicks: number; impressions: number }, m) => {
            acc.spend += Number(m.spend);
            acc.revenue += Number(m.revenue);
            acc.conversions += Number(m.conversions);
            acc.clicks += m.clicks;
            acc.impressions += m.impressions;
            return acc;
          },
          { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 }
        );
        return {
          id: c.id,
          platform: c.platform,
          name: c.name,
          status: c.status,
          objective: c.objective,
          externalCampaignId: c.externalCampaignId,
          connectedAccountId: c.connectedAccountId,
          ...agg,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
      hasMore,
    };
  },

  /** Daily metric rows for one or all campaigns in a date range. */
  async getDailyMetrics(
    userId: string,
    options: { campaignId?: string; platform?: string; startDate: string; endDate: string }
  ) {
    const rows = await prisma.unifiedCampaignMetricDaily.findMany({
      where: {
        userId,
        date: {
          gte: new Date(`${options.startDate}T00:00:00.000Z`),
          lte: new Date(`${options.endDate}T00:00:00.000Z`),
        },
        ...(options.campaignId ? { unifiedCampaignId: options.campaignId } : {}),
        ...(options.platform
          ? { campaign: { platform: toPlatformEnum(options.platform) } }
          : {}),
      },
      select: {
        date: true,
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
        revenue: true,
        campaign: { select: { platform: true, name: true, externalCampaignId: true } },
      },
      orderBy: { date: 'asc' },
    });

    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      platform: row.campaign.platform,
      campaignName: row.campaign.name,
      externalCampaignId: row.campaign.externalCampaignId,
      impressions: row.impressions,
      clicks: row.clicks,
      spend: Number(row.spend),
      conversions: Number(row.conversions),
      revenue: Number(row.revenue),
    }));
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
