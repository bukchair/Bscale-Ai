import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { resolveEffectiveUserId } from '@/src/lib/auth/resolve-effective-user';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';
import { cacheClient } from '@/src/lib/sync/cache/cache-client';
import { cacheKeys } from '@/src/lib/sync/cache/keys';
import { createHash } from 'crypto';

const CAMPAIGNS_CACHE_TTL = 180; // 3 minutes
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const effectiveUserId = await resolveEffectiveUserId(user);
    const url = new URL(request.url);

    const platform = (url.searchParams.get('platform') || '').trim().toUpperCase() || undefined;
    const start = (url.searchParams.get('start') || '').trim() || undefined;
    const end = (url.searchParams.get('end') || '').trim() || undefined;
    const cursor = (url.searchParams.get('cursor') || '').trim() || undefined;
    const take = Math.min(Math.max(Number(url.searchParams.get('take') || 50), 1), 200);

    if (start && !DATE_RE.test(start)) {
      return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 });
    }
    if (end && !DATE_RE.test(end)) {
      return NextResponse.json({ error: 'Invalid end date.' }, { status: 400 });
    }

    const queryHash = createHash('md5')
      .update(JSON.stringify({ platform, start, end }))
      .digest('hex')
      .slice(0, 8);
    const cacheKey = cacheKeys.unifiedCampaigns(effectiveUserId, platform ?? 'all', '', cursor ?? '', take, queryHash);

    const cached = await cacheClient.getJson<ReturnType<typeof unifiedRepo.getCampaigns>>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const result = await unifiedRepo.getCampaigns(effectiveUserId, { platform, startDate: start, endDate: end, cursor, take });
    await cacheClient.setJson(cacheKey, result, CAMPAIGNS_CACHE_TTL);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const status = (error as { statusCode?: number })?.statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Failed to fetch campaigns.';
    return NextResponse.json({ error: message }, { status });
  }
}
