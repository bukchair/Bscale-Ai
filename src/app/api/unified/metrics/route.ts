import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';
import { cacheClient } from '@/src/lib/sync/cache/cache-client';
import { cacheKeys } from '@/src/lib/sync/cache/keys';

const METRICS_CACHE_TTL = 300; // 5 minutes
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);

    const start = (url.searchParams.get('start') || '').trim();
    const end = (url.searchParams.get('end') || '').trim();
    const campaignId = (url.searchParams.get('campaignId') || '').trim() || undefined;
    const platform = (url.searchParams.get('platform') || '').trim().toUpperCase() || undefined;

    if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return NextResponse.json(
        { error: 'Invalid date range. Provide start and end as YYYY-MM-DD with start ≤ end.' },
        { status: 400 }
      );
    }

    const cacheKey = cacheKeys.unifiedMetrics(user.id, start, end, platform ?? 'all', campaignId ?? 'all');
    const cached = await cacheClient.getJson<ReturnType<typeof unifiedRepo.getDailyMetrics>>(cacheKey);
    if (cached) {
      return NextResponse.json({ data: cached, cached: true });
    }

    const data = await unifiedRepo.getDailyMetrics(user.id, { campaignId, platform, startDate: start, endDate: end });
    await cacheClient.setJson(cacheKey, data, METRICS_CACHE_TTL);

    return NextResponse.json({ data });
  } catch (error: unknown) {
    const status = (error as { statusCode?: number })?.statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Failed to fetch metrics.';
    return NextResponse.json({ error: message }, { status });
  }
}
