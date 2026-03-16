import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/prisma';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { cacheClient } from '@/src/lib/sync/cache/cache-client';
import { cacheKeys } from '@/src/lib/sync/cache/keys';

export const runtime = 'nodejs';

const toDateIso = (value: string | null, fallback: Date) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback.toISOString().slice(0, 10);
  return raw;
};

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  const url = new URL(request.url);
  const today = new Date();
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start = toDateIso(url.searchParams.get('start'), defaultStart);
  const end = toDateIso(url.searchParams.get('end'), today);
  const cacheKey = cacheKeys.unifiedOverview(user.id, start, end);

  const cached = await cacheClient.getJson<any>(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, cached: true, data: cached });
  }

  const startAt = new Date(`${start}T00:00:00.000Z`);
  const endAt = new Date(`${end}T23:59:59.999Z`);

  const [snapshots, campaignCount, accountCount] = await Promise.all([
    prisma.unifiedSnapshotDaily.findMany({
      where: {
        userId: user.id,
        date: { gte: startAt, lte: endAt },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.unifiedCampaign.count({
      where: {
        userId: user.id,
      },
    }),
    prisma.connectedAccount.count({
      where: {
        userId: user.id,
        status: { in: ['ACTIVE', 'DISABLED'] },
      },
    }),
  ]);

  const totals = snapshots.reduce(
    (acc, row) => {
      acc.spend += Number(row.totalSpend || 0);
      acc.revenue += Number(row.totalRevenue || 0);
      acc.conversions += Number(row.totalConversions || 0);
      acc.clicks += row.totalClicks;
      acc.impressions += row.totalImpressions;
      return acc;
    },
    { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 }
  );

  const data = {
    range: { start, end },
    totals,
    campaignCount,
    accountCount,
    rows: snapshots.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      spend: Number(row.totalSpend || 0),
      revenue: Number(row.totalRevenue || 0),
      conversions: Number(row.totalConversions || 0),
      clicks: row.totalClicks,
      impressions: row.totalImpressions,
    })),
  };

  await cacheClient.setJson(cacheKey, data, 180);
  return NextResponse.json({ success: true, cached: false, data });
}
