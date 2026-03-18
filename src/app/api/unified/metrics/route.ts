import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { resolveEffectiveOwnerUserId, getRequestedOwnerUid } from '@/src/lib/auth/workspace';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';
import { cacheClient } from '@/src/lib/sync/cache/cache-client';
import { cacheKeys } from '@/src/lib/sync/cache/keys';
import { rateLimit } from '@/src/lib/rate-limit';

const METRICS_CACHE_TTL = 300; // 5 minutes
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATA_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const effectiveUserId = await resolveEffectiveOwnerUserId(
      user.id,
      getRequestedOwnerUid(request, user.id)
    );

    const rl = rateLimit(`metrics:${user.id}`, DATA_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }
    const url = new URL(request.url);

    const start = (url.searchParams.get('start') || '').trim();
    const end = (url.searchParams.get('end') || '').trim();
    const campaignId = (url.searchParams.get('campaignId') || '').trim() || undefined;
    const rawPlatform = (url.searchParams.get('platform') || '').trim().toUpperCase() || undefined;

    const ALLOWED_PLATFORMS = new Set(['GOOGLE_ADS', 'META', 'TIKTOK', 'GA4', 'SEARCH_CONSOLE']);
    if (rawPlatform && !ALLOWED_PLATFORMS.has(rawPlatform)) {
      return NextResponse.json(
        { error: `Invalid platform. Allowed values: ${[...ALLOWED_PLATFORMS].join(', ')}.` },
        { status: 400 }
      );
    }
    const platform = rawPlatform;

    if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return NextResponse.json(
        { error: 'Invalid date range. Provide start and end as YYYY-MM-DD with start ≤ end.' },
        { status: 400 }
      );
    }

    const cacheKey = cacheKeys.unifiedMetrics(effectiveUserId, start, end, platform ?? 'all', campaignId ?? 'all');
    const cached = await cacheClient.getJson<ReturnType<typeof unifiedRepo.getDailyMetrics>>(cacheKey);
    if (cached) {
      return NextResponse.json({ data: cached, cached: true });
    }

    const data = await unifiedRepo.getDailyMetrics(effectiveUserId, { campaignId, platform, startDate: start, endDate: end });
    await cacheClient.setJson(cacheKey, data, METRICS_CACHE_TTL);

    return NextResponse.json({ data });
  } catch (error: unknown) {
    const status = (error as { statusCode?: number })?.statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Failed to fetch metrics.';
    return NextResponse.json({ error: message }, { status });
  }
}
