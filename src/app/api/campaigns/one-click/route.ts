/**
 * POST /api/campaigns/one-click
 *
 * One Click Campaign — server-side orchestration:
 *   1. Idempotency check (prevents duplicate launches)
 *   2. AI strategy generation (Gemini via env key)
 *   3. Parallel platform creation (Google / Meta / TikTok)
 *   4. Persist result to DB for audit / retry
 *   5. Return unified result to client
 *
 * Platform-specific logic lives in:
 *   lib/one-click/builders/{google,meta,tiktok}.ts
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';
import { logWithUserContext } from '@/src/lib/logging/server-structured-log';
import { getCampaignBuilderSuggestions } from '@/src/lib/gemini';
import { sanitize } from '@/src/lib/one-click/shared';
import { createGoogleDraft } from '@/src/lib/one-click/builders/google';
import { createMetaDraft } from '@/src/lib/one-click/builders/meta';
import { createTikTokDraft } from '@/src/lib/one-click/builders/tiktok';
import { auditService } from '@/src/lib/integrations/services/audit-service';
import type {
  OneClickInput,
  OneClickObjective,
  OneClickPlatform,
  OneClickResult,
  OneClickStrategy,
  PlatformResult,
} from '@/src/lib/one-click/types';

// ─── AI strategy generation ───────────────────────────────────────────────────

const generateAiStrategy = async (input: OneClickInput): Promise<OneClickStrategy> => {
  const contextData = JSON.stringify({
    product: input.product,
    objective: input.objective,
    dailyBudget: input.dailyBudget,
    country: input.country,
    language: input.language,
    platforms: input.platforms,
  });

  const responseLanguage = input.language === 'he' ? 'Hebrew' : 'English';
  let suggestion: Record<string, unknown> = {};

  try {
    const result = await getCampaignBuilderSuggestions(contextData, undefined, responseLanguage);
    if (result && typeof result === 'object') suggestion = result as Record<string, unknown>;
  } catch {
    // Non-fatal — fall through to defaults below
  }

  const platformCopy: Partial<Record<OneClickPlatform, { title: string; description: string; cta?: string }>> = {};
  for (const platform of input.platforms) {
    const suggested = (suggestion?.platformCopy as Record<string, unknown> | undefined)?.[platform] as
      | { title?: string; description?: string }
      | undefined;
    platformCopy[platform] = {
      title: suggested?.title || input.product?.name || 'New Campaign',
      description: suggested?.description || input.product?.description || '',
      cta: 'Shop Now',
    };
  }

  return {
    campaignName: String(suggestion?.campaignName || input.product?.name || 'BScale Campaign').slice(0, 120),
    shortTitle: String(suggestion?.shortTitle || input.product?.name || '').slice(0, 90),
    audiences: Array.isArray(suggestion?.audiences) ? (suggestion.audiences as string[]).slice(0, 6) : [],
    platformCopy,
    objective: input.objective,
  };
};

// ─── Idempotency ──────────────────────────────────────────────────────────────

const buildIdempotencyKey = (userId: string, rawKey: string): string =>
  createHash('sha256').update(`${userId}:${rawKey}`).digest('hex');

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser().catch(() => null);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // ── Parse body (JSON or multipart with media file) ───────────────────────
    let body: Partial<OneClickInput> & { idempotencyKey?: string } = {};
    let mediaBuffer: Buffer | undefined;
    let mediaMimeType: string | undefined;

    try {
      const ct = request.headers.get('content-type') || '';
      if (ct.includes('multipart/form-data')) {
        const fd = await request.formData();
        const bodyStr = fd.get('body');
        if (typeof bodyStr === 'string') body = JSON.parse(bodyStr) as typeof body;
        const file = fd.get('media');
        if (file instanceof File && file.size > 0) {
          mediaBuffer = Buffer.from(await file.arrayBuffer());
          mediaMimeType = file.type || 'image/jpeg';
        }
      } else {
        body = (await request.json()) as typeof body;
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    // ── Validate ─────────────────────────────────────────────────────────────
    const platforms = (Array.isArray(body.platforms) ? body.platforms : []).filter(
      (p): p is OneClickPlatform => p === 'Google' || p === 'Meta' || p === 'TikTok'
    );
    if (!platforms.length) {
      return NextResponse.json({ error: 'At least one platform is required.' }, { status: 400 });
    }
    const objective: OneClickObjective =
      body.objective === 'leads' ? 'leads' : body.objective === 'traffic' ? 'traffic' : 'sales';
    const dailyBudget = Math.max(Number(body.dailyBudget) || 20, 1);
    const country = String(body.country || 'US').slice(0, 10);
    const language = String(body.language || 'en').slice(0, 10);
    const rawIdempotencyKey = String(body.idempotencyKey || `${Date.now()}-${Math.random()}`);
    const idempotencyKey = buildIdempotencyKey(user.id, rawIdempotencyKey);
    const activateImmediately = body.activateImmediately === true;

    const input: OneClickInput = {
      idempotencyKey,
      platforms,
      objective,
      dailyBudget,
      country,
      language,
      activateImmediately,
      product: body.product
        ? {
            name: sanitize(body.product.name || '', 120),
            description: sanitize(body.product.description || '', 500),
            price: String(body.product.price || '').slice(0, 30),
            url: String(body.product.url || '').slice(0, 500),
            imageUrl: String(body.product.imageUrl || '').slice(0, 1000) || undefined,
          }
        : undefined,
    };

    // ── Preview-only: return AI strategy without DB or platform creation ─────
    const previewOnly = (body as Record<string, unknown>).previewOnly === true;
    if (previewOnly) {
      try {
        const strategy = await generateAiStrategy(input);
        return NextResponse.json({
          requestId: 'preview',
          idempotencyKey,
          status: 'SUCCESS',
          strategy,
          results: {},
        } satisfies OneClickResult);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'AI strategy generation failed.' },
          { status: 500 }
        );
      }
    }

    // ── Idempotency: return cached result if already succeeded ────────────────
    const existing = await prisma.oneClickCampaignRequest.findUnique({
      where: { idempotencyKey },
    }).catch(() => null);

    if (existing && (existing.status === 'SUCCESS' || existing.status === 'PARTIAL')) {
      return NextResponse.json({
        requestId: existing.id,
        idempotencyKey,
        status: existing.status,
        strategy: existing.aiStrategy as OneClickStrategy,
        results: existing.results as Partial<Record<string, PlatformResult>>,
        cached: true,
      } satisfies OneClickResult & { cached: boolean });
    }

    // ── Create/reset DB record ────────────────────────────────────────────────
    let record = existing;
    try {
      if (record) {
        record = await prisma.oneClickCampaignRequest.update({
          where: { id: record.id },
          data: { status: 'RUNNING', errorMessage: null, updatedAt: new Date() },
        });
      } else {
        record = await prisma.oneClickCampaignRequest.create({
          data: {
            userId: user.id,
            idempotencyKey,
            platforms: platforms as unknown as string[],
            objective,
            dailyBudget,
            country,
            language,
            productInfo: input.product ?? undefined,
            status: 'RUNNING',
          },
        });
      }
    } catch (dbErr) {
      console.error('[one-click] DB record creation failed:', dbErr);
      return NextResponse.json(
        { error: 'Failed to initialize campaign request. The database may need a migration.' },
        { status: 500 }
      );
    }

    // ── Generate AI strategy ──────────────────────────────────────────────────
    const strategy = await generateAiStrategy(input).catch((): OneClickStrategy => ({
      campaignName: input.product?.name || 'BScale Campaign',
      shortTitle: input.product?.name || '',
      audiences: [],
      platformCopy: {},
      objective: input.objective,
    }));

    await prisma.oneClickCampaignRequest.update({
      where: { id: record.id },
      data: { aiStrategy: strategy as unknown as object },
    });

    // ── Run platform creators in parallel ─────────────────────────────────────
    const campaignName = strategy.campaignName;
    const creatorMap: Record<OneClickPlatform, () => Promise<PlatformResult>> = {
      Google: () => createGoogleDraft(user.id, campaignName, objective, dailyBudget, strategy, activateImmediately, input.country, input.product),
      Meta:   () => createMetaDraft(user.id, campaignName, objective, dailyBudget, strategy, activateImmediately, input.country, input.product, mediaBuffer, mediaMimeType),
      TikTok: () => createTikTokDraft(user.id, campaignName, objective, dailyBudget, strategy, activateImmediately, input.country, input.product, mediaBuffer, mediaMimeType),
    };

    const settled = await Promise.allSettled(
      platforms.map(async (platform) => ({ platform, result: await creatorMap[platform]() }))
    );

    const results: Partial<Record<OneClickPlatform, PlatformResult>> = {};
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        results[item.value.platform] = item.value.result;
        if (!item.value.result.ok) {
          console.error(`[one-click] ${item.value.platform} failed:`, item.value.result.message);
        }
      } else {
        const platform = platforms[settled.indexOf(item)];
        const msg = item.reason instanceof Error ? item.reason.message : 'Unexpected error.';
        console.error(`[one-click] ${platform} rejected:`, msg);
        results[platform] = { ok: false, message: msg, campaignStatus: 'Error' };
      }
    }

    const allOk = platforms.every((p) => results[p]?.ok);
    const anyOk = platforms.some((p) => results[p]?.ok);
    const finalStatus: OneClickResult['status'] = allOk ? 'SUCCESS' : anyOk ? 'PARTIAL' : 'FAILED';

    // ── Persist result ────────────────────────────────────────────────────────
    await prisma.oneClickCampaignRequest.update({
      where: { id: record.id },
      data: {
        status: finalStatus,
        results: results as unknown as object,
        errorMessage: finalStatus === 'FAILED' ? 'All platform campaign creations failed.' : null,
        updatedAt: new Date(),
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────────────
    await auditService.log({
      userId: user.id,
      action: 'one_click_campaign_created',
      platform: undefined,
      connectionId: undefined,
      details: { requestId: record.id, platforms, objective, dailyBudget, status: finalStatus, results },
    }).catch((err) => {
      // Non-fatal: audit log failure must not block the campaign response.
      console.error('[one-click] auditService.log failed:', err);
    });

    const responseBody: OneClickResult = {
      requestId: record.id,
      idempotencyKey,
      status: finalStatus,
      strategy,
      results,
    };

    return NextResponse.json(responseBody, {
      status: finalStatus === 'FAILED' ? 422 : 200,
    });
  } catch (err) {
    logWithUserContext('ERROR', 'one-click campaign unexpected error', {
      path: '/api/campaigns/one-click',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error.' },
      { status: 500 }
    );
  }
}
