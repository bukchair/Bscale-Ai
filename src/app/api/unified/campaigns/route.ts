import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/prisma';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { cacheClient } from '@/src/lib/sync/cache/cache-client';
import { cacheKeys } from '@/src/lib/sync/cache/keys';

export const runtime = 'nodejs';

const mapPlatformQueryToDb = (value: string) => {
  if (value === 'Google') return 'GOOGLE_ADS';
  if (value === 'Meta') return 'META';
  if (value === 'TikTok') return 'TIKTOK';
  return '';
};

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  const url = new URL(request.url);
  const platformQuery = String(url.searchParams.get('platform') || '').trim();
  const accountId = String(url.searchParams.get('accountId') || '').trim();
  const query = String(url.searchParams.get('q') || '').trim();
  const take = Math.max(1, Math.min(200, Number(url.searchParams.get('take') || 50)));
  const cursor = String(url.searchParams.get('cursor') || '').trim();

  const cacheKey = cacheKeys.unifiedCampaigns(
    user.id,
    platformQuery || 'all',
    accountId || 'all',
    cursor || 'start',
    take,
    query ? Buffer.from(query).toString('base64').slice(0, 24) : 'none'
  );
  const cached = await cacheClient.getJson<any>(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, cached: true, ...cached });
  }

  const platform = mapPlatformQueryToDb(platformQuery);
  const rows = await prisma.unifiedCampaign.findMany({
    where: {
      userId: user.id,
      platform: platform ? (platform as any) : undefined,
      connectedAccountId: accountId || undefined,
      name: query
        ? {
            contains: query,
            mode: 'insensitive',
          }
        : undefined,
    },
    include: {
      metricsDaily: {
        orderBy: { date: 'desc' },
        take: 7,
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
  });

  const result = {
    rows: rows.map((row) => ({
      id: row.id,
      externalCampaignId: row.externalCampaignId,
      platform: row.platform,
      name: row.name,
      status: row.status,
      objective: row.objective,
      last7d: row.metricsDaily.reduce(
        (acc, metric) => {
          acc.spend += Number(metric.spend || 0);
          acc.revenue += Number(metric.revenue || 0);
          acc.conversions += Number(metric.conversions || 0);
          acc.clicks += metric.clicks;
          acc.impressions += metric.impressions;
          return acc;
        },
        { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 }
      ),
    })),
    nextCursor: rows.length === take ? rows[rows.length - 1].id : null,
  };

  await cacheClient.setJson(cacheKey, result, 120);
  return NextResponse.json({ success: true, cached: false, ...result });
}
