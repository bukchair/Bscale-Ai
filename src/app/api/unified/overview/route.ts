import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';
import { cacheClient } from '@/src/lib/sync/cache/cache-client';
import { cacheKeys } from '@/src/lib/sync/cache/keys';

const OVERVIEW_CACHE_TTL = 300; // 5 minutes
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const start = (url.searchParams.get('start') || '').trim();
    const end = (url.searchParams.get('end') || '').trim();

    if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return NextResponse.json(
        { error: 'Invalid date range. Provide start and end as YYYY-MM-DD with start ≤ end.' },
        { status: 400 }
      );
    }

    const cacheKey = cacheKeys.unifiedOverview(user.id, start, end);
    const cached = await cacheClient.getJson<ReturnType<typeof unifiedRepo.getOverview>>(cacheKey);
    if (cached) {
      return NextResponse.json({ data: cached, cached: true });
    }

    const data = await unifiedRepo.getOverview(user.id, start, end);
    await cacheClient.setJson(cacheKey, data, OVERVIEW_CACHE_TTL);

    return NextResponse.json({ data });
  } catch (error: unknown) {
    const status = (error as { statusCode?: number })?.statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Failed to fetch unified overview.';
    return NextResponse.json({ error: message }, { status });
  }
}
