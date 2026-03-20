/**
 * POST /api/campaigns/one-click
 *
 * One Click Campaign — server-side orchestration:
 *   1. Idempotency check (prevents duplicate launches)
 *   2. AI strategy generation (Gemini via env key)
 *   3. Parallel platform creation (Google / Meta / TikTok) — always PAUSED
 *   4. Persist result to DB for audit / retry
 *   5. Return unified result to client
 *
 * Reuses: requireAuthenticatedUser, googleLegacyBridge, MetaProvider,
 *         TikTokProvider, tokenService, connectionService, auditService,
 *         getCampaignBuilderSuggestions, GOOGLE_ADS_API_BASE, META_GRAPH_BASE,
 *         TIKTOK_API_BASE constants.
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import { auditService } from '@/src/lib/integrations/services/audit-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { TikTokProvider } from '@/src/lib/integrations/providers/tiktok/provider';
import { getCampaignBuilderSuggestions } from '@/src/lib/gemini';
import {
  GOOGLE_ADS_API_BASE,
  META_GRAPH_BASE,
  TIKTOK_API_BASE,
} from '@/src/lib/constants/api-urls';
import type {
  OneClickInput,
  OneClickObjective,
  OneClickPlatform,
  OneClickResult,
  OneClickStrategy,
  PlatformResult,
} from '@/src/lib/one-click/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sanitize = (v: string, maxLen = 120) => String(v || '').trim().slice(0, maxLen);

const extractError = async (res: Response): Promise<string> => {
  const raw = await res.text().catch(() => '');
  if (!raw) return `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return (
      String(parsed?.error?.message || parsed?.message || parsed?.data?.message || '').trim() ||
      raw.slice(0, 260)
    );
  } catch {
    return raw.slice(0, 260);
  }
};

// Map our unified objective to platform-specific strings
const toMetaObjective = (o: OneClickObjective): string => {
  if (o === 'sales') return 'OUTCOME_SALES';
  if (o === 'leads') return 'OUTCOME_LEADS';
  return 'OUTCOME_TRAFFIC';
};

const toTikTokObjective = (o: OneClickObjective): string => {
  if (o === 'sales') return 'CONVERSIONS';
  if (o === 'leads') return 'LEAD_GENERATION';
  return 'TRAFFIC';
};

// ─── Platform creators ────────────────────────────────────────────────────────
// One-click campaigns are always created as PAUSED drafts for user review.

const createGoogleDraft = async (
  userId: string,
  name: string,
  objective: OneClickObjective,
  dailyBudget: number,
  _strategy: OneClickStrategy
): Promise<PlatformResult> => {
  try {
    if (!integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
      return { ok: false, message: 'GOOGLE_ADS_DEVELOPER_TOKEN is not configured.', campaignStatus: 'Error' };
    }

    const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
      userId,
      'GOOGLE_ADS'
    );
    const customerId = googleLegacyBridge.pickSelectedAccountId(connection);
    if (!customerId) {
      return { ok: false, message: 'No selected Google Ads account found.', campaignStatus: 'Error' };
    }

    const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    // 1. Create shared campaign budget
    const budgetRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignBudgets:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: `${sanitize(name)} Budget ${Date.now()}`,
                amountMicros: Math.round(Math.max(dailyBudget, 1) * 1_000_000),
                deliveryMethod: 'STANDARD',
                explicitlyShared: false,
              },
            },
          ],
        }),
      }
    );
    if (!budgetRes.ok) {
      return { ok: false, message: await extractError(budgetRes), campaignStatus: 'Error' };
    }
    const budgetPayload = (await budgetRes.json()) as Record<string, unknown>;
    const budgetResourceName = String(
      (budgetPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || ''
    );
    if (!budgetResourceName) {
      return { ok: false, message: 'Google budget created without resource name.', campaignStatus: 'Error' };
    }

    // 2. Create campaign (always PAUSED draft)
    const channelType =
      objective === 'traffic' ? 'DISPLAY' : objective === 'leads' ? 'SEARCH' : 'SEARCH';

    const campaignRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: sanitize(name),
                status: 'PAUSED', // always draft — user activates after review
                advertisingChannelType: channelType,
                campaignBudget: budgetResourceName,
                targetSpend: {},
                networkSettings: {
                  targetGoogleSearch: true,
                  targetSearchNetwork: false,
                  targetContentNetwork: channelType === 'DISPLAY',
                },
                startDate: new Date().toISOString().slice(0, 10),
              },
            },
          ],
        }),
      }
    );
    if (!campaignRes.ok) {
      return { ok: false, message: await extractError(campaignRes), campaignStatus: 'Error' };
    }
    const campaignPayload = (await campaignRes.json()) as Record<string, unknown>;
    const resourceName = String(
      (campaignPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || ''
    );
    const campaignId = resourceName.split('/').pop() || resourceName;

    return {
      ok: true,
      campaignId,
      message: `Google Ads draft campaign created (PAUSED). Budget: ${dailyBudget}/day.`,
      campaignStatus: 'Draft',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Google campaign creation failed.',
      campaignStatus: 'Error',
    };
  }
};

const createMetaDraft = async (
  userId: string,
  name: string,
  objective: OneClickObjective,
  dailyBudget: number,
  _strategy: OneClickStrategy
): Promise<PlatformResult> => {
  try {
    const connection = await connectionService.getByUserPlatform(userId, 'META');
    if (!connection || connection.status !== 'CONNECTED') {
      return { ok: false, message: 'Meta connection is not active.', campaignStatus: 'Error' };
    }

    const account =
      connection.connectedAccounts.find((a) => a.isSelected) || connection.connectedAccounts[0];
    if (!account?.externalAccountId) {
      return { ok: false, message: 'No selected Meta ad account found.', campaignStatus: 'Error' };
    }

    const provider = new MetaProvider();
    const accessToken = await provider.getAccessTokenForConnection(connection.id, userId);
    const accountResource = account.externalAccountId.startsWith('act_')
      ? account.externalAccountId
      : `act_${account.externalAccountId}`;

    // Create campaign (always PAUSED)
    const form = new URLSearchParams();
    form.set('name', sanitize(name));
    form.set('objective', toMetaObjective(objective));
    form.set('status', 'PAUSED');
    form.set('buying_type', 'AUCTION');
    form.set('special_ad_categories', JSON.stringify([]));

    const campaignRes = await fetch(`${META_GRAPH_BASE}/${accountResource}/campaigns`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Bearer ${accessToken}`,
      },
      body: form.toString(),
    });
    if (!campaignRes.ok) {
      return { ok: false, message: await extractError(campaignRes), campaignStatus: 'Error' };
    }
    const campaignPayload = (await campaignRes.json()) as Record<string, unknown>;
    const campaignId = String(campaignPayload?.id || '');

    // Create ad set with daily budget (always PAUSED)
    const adSetForm = new URLSearchParams();
    adSetForm.set('name', `${sanitize(name)} – Ad Set`);
    adSetForm.set('campaign_id', campaignId);
    adSetForm.set('status', 'PAUSED');
    adSetForm.set('billing_event', 'IMPRESSIONS');
    adSetForm.set('optimization_goal', objective === 'leads' ? 'LEAD_GENERATION' : 'OFFSITE_CONVERSIONS');
    adSetForm.set('daily_budget', String(Math.round(Math.max(dailyBudget, 1) * 100))); // in cents
    adSetForm.set('bid_strategy', 'LOWEST_COST_WITHOUT_CAP');
    adSetForm.set('targeting', JSON.stringify({ age_min: 18, age_max: 65, publisher_platforms: ['facebook', 'instagram'] }));

    const adSetRes = await fetch(`${META_GRAPH_BASE}/${accountResource}/adsets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Bearer ${accessToken}`,
      },
      body: adSetForm.toString(),
    });

    // Ad set failure is non-fatal — campaign itself was created
    const adSetMsg = adSetRes.ok
      ? ''
      : ` (Ad set creation failed: ${await extractError(adSetRes)})`;

    return {
      ok: true,
      campaignId,
      message: `Meta Ads draft campaign created (PAUSED). Budget: ${dailyBudget}/day.${adSetMsg}`,
      campaignStatus: 'Draft',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Meta campaign creation failed.',
      campaignStatus: 'Error',
    };
  }
};

const createTikTokDraft = async (
  userId: string,
  name: string,
  objective: OneClickObjective,
  dailyBudget: number,
  _strategy: OneClickStrategy
): Promise<PlatformResult> => {
  try {
    const connection = await connectionService.getByUserPlatform(userId, 'TIKTOK');
    if (!connection || connection.status !== 'CONNECTED') {
      return { ok: false, message: 'TikTok connection is not active.', campaignStatus: 'Error' };
    }

    const account =
      connection.connectedAccounts.find((a) => a.isSelected) || connection.connectedAccounts[0];
    if (!account?.externalAccountId) {
      return { ok: false, message: 'No selected TikTok advertiser found.', campaignStatus: 'Error' };
    }

    // Refresh token if expiring
    const provider = new TikTokProvider();
    const expiresSoon =
      !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() <= Date.now() + 60_000;
    if (expiresSoon) {
      const refreshed = await provider.refreshToken({
        connectionId: connection.id,
        userId,
        encryptedRefreshToken: connection.encryptedRefreshToken,
      });
      await tokenService.saveTokenSet(userId, connection.id, refreshed);
    }
    const accessToken = await tokenService.getAccessToken(connection.id, userId);

    const res = await fetch(`${TIKTOK_API_BASE}/campaign/create/`, {
      method: 'POST',
      headers: { 'Access-Token': accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({
        advertiser_id: account.externalAccountId,
        campaign_name: sanitize(name),
        objective_type: toTikTokObjective(objective),
        budget_mode: 'BUDGET_MODE_DAY',
        budget: Math.max(dailyBudget, 1),
        operation_status: 'DISABLE', // always paused
      }),
    });

    const payload = (await res.json()) as Record<string, unknown>;
    if (!res.ok || Number(payload?.code) !== 0) {
      return {
        ok: false,
        message: String(payload?.message || '').trim() || `TikTok API error (${res.status}).`,
        campaignStatus: 'Error',
      };
    }

    const campaignId = String(
      (payload?.data as Record<string, unknown>)?.campaign_id || ''
    );

    // Create Ad Group (required by TikTok — Campaign alone cannot be activated)
    const toTikTokOptimizationGoal = (o: OneClickObjective) => {
      if (o === 'sales') return 'CONVERT';
      if (o === 'leads') return 'LEAD_GENERATION';
      return 'CLICK';
    };
    const toTikTokBillingEvent = (o: OneClickObjective) =>
      o === 'traffic' ? 'CPC' : 'OCPM';

    const scheduleStart = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const adGroupRes = await fetch(`${TIKTOK_API_BASE}/adgroup/create/`, {
      method: 'POST',
      headers: { 'Access-Token': accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({
        advertiser_id: account.externalAccountId,
        campaign_id: campaignId,
        adgroup_name: `${sanitize(name)} – Ad Group`,
        placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
        budget_mode: 'BUDGET_MODE_DAY',
        budget: Math.max(dailyBudget, 1),
        schedule_type: 'SCHEDULE_FROM_NOW',
        schedule_start_time: scheduleStart,
        optimization_goal: toTikTokOptimizationGoal(objective),
        billing_event: toTikTokBillingEvent(objective),
        operation_status: 'DISABLE',
      }),
    });

    const adGroupPayload = (await adGroupRes.json()) as Record<string, unknown>;
    const adGroupMsg = adGroupRes.ok && Number(adGroupPayload?.code) === 0
      ? ''
      : ` (Ad Group creation failed: ${String(adGroupPayload?.message || '').trim() || `HTTP ${adGroupRes.status}`})`;

    return {
      ok: true,
      campaignId,
      message: `TikTok Ads draft campaign created (DISABLED). Budget: ${dailyBudget}/day.${adGroupMsg}`,
      campaignStatus: 'Draft',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'TikTok campaign creation failed.',
      campaignStatus: 'Error',
    };
  }
};

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
    // getCampaignBuilderSuggestions falls back to GEMINI_API_KEY env var when no key is passed.
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

  let body: Partial<OneClickInput> & { idempotencyKey?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── Validate ──────────────────────────────────────────────────────────────
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

  const input: OneClickInput = {
    idempotencyKey,
    platforms,
    objective,
    dailyBudget,
    country,
    language,
    product: body.product
      ? {
          name: sanitize(body.product.name || '', 120),
          description: sanitize(body.product.description || '', 500),
          price: String(body.product.price || '').slice(0, 30),
          url: String(body.product.url || '').slice(0, 500),
        }
      : undefined,
  };

  // ── Preview-only: return AI strategy without DB or platform creation ──────
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
      strategy: existing.aiStrategy,
      results: existing.results,
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
          productInfo: input.product ?? null,
          status: 'RUNNING',
        },
      });
    }
  } catch (dbErr) {
    console.error('[one-click] DB record creation failed:', dbErr);
    return NextResponse.json({ error: 'Failed to initialize campaign request. The database may need a migration.' }, { status: 500 });
  }

  // ── Generate AI strategy ──────────────────────────────────────────────────
  const strategy = await generateAiStrategy(input).catch((err): OneClickStrategy => ({
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
    Google: () => createGoogleDraft(user.id, campaignName, objective, dailyBudget, strategy),
    Meta: () => createMetaDraft(user.id, campaignName, objective, dailyBudget, strategy),
    TikTok: () => createTikTokDraft(user.id, campaignName, objective, dailyBudget, strategy),
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
    details: {
      requestId: record.id,
      platforms,
      objective,
      dailyBudget,
      status: finalStatus,
      results,
    },
  }).catch(() => {}); // non-fatal

  const responseBody: OneClickResult = {
    requestId: record.id,
    idempotencyKey,
    status: finalStatus,
    strategy,
    results,
  };

  return NextResponse.json(responseBody, { status: allOk || anyOk ? 200 : 422 });
  } catch (err) {
    console.error('[one-click] Unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/campaigns/one-click?requestId=...
 * Returns the status and results of a previous request.
 */
export async function GET(request: Request) {
  const user = await requireAuthenticatedUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get('requestId');
  if (!requestId) return NextResponse.json({ error: 'requestId is required.' }, { status: 400 });

  const record = await prisma.oneClickCampaignRequest.findFirst({
    where: { id: requestId, userId: user.id },
  }).catch(() => null);

  if (!record) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });

  return NextResponse.json({
    requestId: record.id,
    status: record.status,
    strategy: record.aiStrategy,
    results: record.results,
    createdAt: record.createdAt,
  });
}
