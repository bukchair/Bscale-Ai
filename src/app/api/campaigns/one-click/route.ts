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

// Country code → Google Geo Target Constant ID
const GOOGLE_GEO: Record<string, number> = {
  IL: 2376, US: 2840, GB: 2826, DE: 2276, FR: 2250,
  CA: 2124, AU: 2036, NL: 2528, ES: 2510, IT: 2380,
};

// Country code → TikTok location ID (GeoNames-based)
const TIKTOK_GEO: Record<string, string> = {
  US: '6252001', GB: '2635167', DE: '2921044', FR: '3017382',
  CA: '6251999', AU: '2077456', NL: '2750405', IL: '294640',
  ES: '2510769', IT: '3175395',
};

const extractError = async (res: Response): Promise<string> => {
  const raw = await res.text().catch(() => '');
  if (!raw) return `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const e = parsed?.error as Record<string, unknown> | undefined;
    const d = parsed?.data as Record<string, unknown> | undefined;
    return (
      String(e?.message || parsed?.message || d?.message || '').trim() ||
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

// ─── Google RSA helpers ───────────────────────────────────────────────────────

const hl = (text: string) => ({ text: text.trim().slice(0, 30) });
const desc = (text: string) => ({ text: text.trim().slice(0, 90) });

const buildRsaHeadlines = (
  strategy: OneClickStrategy,
  productName: string,
  price?: string
): Array<{ text: string }> => {
  const objective = strategy.objective;
  const aiTitle = strategy.platformCopy?.Google?.title?.trim() || '';
  const objectivePhrases: Record<string, string[]> = {
    sales:   ['Shop Now & Save', 'Order Today', 'Best Deals Online'],
    leads:   ['Get a Free Quote', 'Contact Us Today', 'Request Info Now'],
    traffic: ['Visit Our Website', 'Discover More Today', 'Learn More Here'],
  };

  const candidates = [
    aiTitle,
    productName,
    strategy.campaignName,
    price ? `From ${price}` : '',
    ...(objectivePhrases[objective] || []),
  ]
    .map((t) => t.trim().slice(0, 30))
    .filter(Boolean);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c)) { seen.add(c); unique.push(c); }
  }

  return unique.slice(0, 15).map(hl);
};

const buildRsaDescriptions = (
  strategy: OneClickStrategy,
  productDescription?: string
): Array<{ text: string }> => {
  const aiDesc = strategy.platformCopy?.Google?.description?.trim() || '';
  const candidates = [
    aiDesc,
    productDescription?.trim() || '',
    `${strategy.campaignName} — click to learn more`.slice(0, 90),
  ].map((t) => t.slice(0, 90)).filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c)) { seen.add(c); unique.push(c); }
  }

  return unique.slice(0, 4).map(desc);
};

const buildKeywords = (productName: string, audiences: string[]): string[] => {
  const kws: string[] = [];
  if (productName) kws.push(productName.slice(0, 80));
  for (const w of productName.split(/\s+/).filter((w) => w.length > 2).slice(0, 3)) {
    kws.push(w);
  }
  for (const a of audiences.slice(0, 3)) kws.push(a.slice(0, 80));
  return [...new Set(kws)].slice(0, 10);
};

// ─── Meta helpers ─────────────────────────────────────────────────────────────

const toMetaCTA = (o: OneClickObjective) =>
  o === 'sales' ? 'SHOP_NOW' : 'LEARN_MORE';

/** Fetch first Facebook Page ID the token has access to (needed for Ad Creative) */
const fetchMetaPageId = async (accessToken: string): Promise<string | null> => {
  try {
    const res = await fetch(
      `${META_GRAPH_BASE}/me/accounts?fields=id&limit=1&access_token=${accessToken}`
    );
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return data?.data?.[0]?.id || null;
  } catch {
    return null;
  }
};

/** Upload image buffer to Meta ad account. Returns image hash or null. */
const uploadMetaImage = async (
  imageSource: string | Buffer,
  accountResource: string,
  accessToken: string,
  mimeType = 'image/jpeg'
): Promise<string | null> => {
  try {
    let buffer: Buffer;
    let contentType = mimeType;
    if (typeof imageSource === 'string') {
      const imgRes = await fetch(imageSource);
      if (!imgRes.ok) return null;
      buffer = Buffer.from(await imgRes.arrayBuffer());
      contentType = imgRes.headers.get('content-type') || mimeType;
    } else {
      buffer = imageSource;
    }
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `product.${ext}`;
    const form = new FormData();
    form.append('filename', new Blob([buffer], { type: contentType }), filename);
    const uploadRes = await fetch(`${META_GRAPH_BASE}/${accountResource}/adimages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const uploadData = (await uploadRes.json()) as { images?: Record<string, { hash?: string }> };
    return uploadData?.images?.[filename]?.hash || null;
  } catch {
    return null;
  }
};

// ─── TikTok helpers ───────────────────────────────────────────────────────────

const toTikTokCTA = (o: OneClickObjective) =>
  o === 'sales' ? 'SHOP_NOW' : 'LEARN_MORE';

/** Upload image (URL or Buffer) to TikTok ad library. Returns image_id or null. */
const uploadTikTokImage = async (
  imageSource: string | Buffer,
  advertiserId: string,
  accessToken: string,
  mimeType = 'image/jpeg'
): Promise<string | null> => {
  try {
    let buffer: Buffer;
    let contentType = mimeType;
    if (typeof imageSource === 'string') {
      const imgRes = await fetch(imageSource);
      if (!imgRes.ok) return null;
      buffer = Buffer.from(await imgRes.arrayBuffer());
      contentType = imgRes.headers.get('content-type') || mimeType;
    } else {
      buffer = imageSource;
    }
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const form = new FormData();
    form.append('advertiser_id', advertiserId);
    form.append('image_file', new Blob([buffer], { type: contentType }), `product.${ext}`);
    const uploadRes = await fetch(`${TIKTOK_API_BASE}/file/image/ad/upload/`, {
      method: 'POST',
      headers: { 'Access-Token': accessToken },
      body: form,
    });
    const data = (await uploadRes.json()) as { code?: number; data?: { image_id?: string } };
    if (Number(data?.code) !== 0) return null;
    return data?.data?.image_id || null;
  } catch {
    return null;
  }
};

// ─── Platform creators ────────────────────────────────────────────────────────

const createGoogleDraft = async (
  userId: string,
  name: string,
  objective: OneClickObjective,
  dailyBudget: number,
  strategy: OneClickStrategy,
  activateImmediately = false,
  country = 'US',
  product?: OneClickInput['product']
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

    // 2. Create campaign — always SEARCH (simplest, no pixel/form requirements)
    const channelType = 'SEARCH';

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
                status: activateImmediately ? 'ENABLED' : 'PAUSED',
                advertisingChannelType: channelType,
                campaignBudget: budgetResourceName,
                maximizeClicks: {},
                networkSettings: {
                  targetGoogleSearch: true,
                  targetSearchNetwork: true,
                  targetContentNetwork: false,
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

    // 3. Add geo-targeting (non-fatal)
    const geoCriteriaId = GOOGLE_GEO[country.toUpperCase()];
    if (geoCriteriaId && resourceName) {
      await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignCriteria:mutate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              campaign: resourceName,
              location: { geoTargetConstant: `geoTargetConstants/${geoCriteriaId}` },
            },
          }],
        }),
      }).catch(() => {}); // non-fatal
    }

    // 4. Create Ad Group
    const adGroupStatus = activateImmediately ? 'ENABLED' : 'PAUSED';
    const adGroupRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroups:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              name: `${sanitize(name)} – Ad Group`,
              campaign: resourceName,
              status: adGroupStatus,
              type: 'SEARCH_STANDARD',
              cpcBidMicros: 1_000_000, // $1 default CPC
            },
          }],
        }),
      }
    );

    if (!adGroupRes.ok) {
      // Ad group failure is non-fatal — campaign was created
      const adGroupErr = await extractError(adGroupRes);
      console.error('[one-click] Google ad group failed:', adGroupErr);
      return {
        ok: true,
        campaignId,
        message: `Google Ads campaign created (${activateImmediately ? 'ENABLED' : 'PAUSED'}). Ad group failed: ${adGroupErr}`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }

    const adGroupPayload = (await adGroupRes.json()) as Record<string, unknown>;
    const adGroupResourceName = String(
      (adGroupPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || ''
    );
    const adGroupId = adGroupResourceName.split('/').pop() || '';

    // 5. Create Keywords (non-fatal)
    const keywords = buildKeywords(product?.name || name, strategy.audiences);
    if (keywords.length > 0 && adGroupResourceName) {
      await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroupCriteria:mutate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: keywords.map((kw) => ({
            create: {
              adGroup: adGroupResourceName,
              status: 'ENABLED',
              keyword: { text: kw, matchType: 'BROAD' },
            },
          })),
        }),
      }).catch((e) => console.error('[one-click] Google keywords failed:', e));
    }

    // 6. Create Responsive Search Ad (requires finalUrl)
    const finalUrl = product?.url?.trim();
    if (!finalUrl) {
      return {
        ok: true,
        campaignId,
        adId: adGroupId,
        message: `Google Ads campaign + ad group created (${activateImmediately ? 'ENABLED' : 'PAUSED'}). No URL provided — RSA skipped.`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }

    const headlines = buildRsaHeadlines(strategy, product?.name || name, product?.price);
    const descriptions = buildRsaDescriptions(strategy, product?.description);

    // RSA requires ≥3 headlines and ≥2 descriptions
    if (headlines.length < 3) {
      headlines.push(hl('Learn More'), hl('Get Started Today'), hl('Contact Us Now'));
    }
    if (descriptions.length < 2) {
      descriptions.push(desc('Click to learn more about our products and services.'));
    }

    const rsaRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroupAds:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              adGroup: adGroupResourceName,
              status: adGroupStatus,
              ad: {
                responsiveSearchAd: {
                  headlines: headlines.slice(0, 15),
                  descriptions: descriptions.slice(0, 4),
                },
                finalUrls: [finalUrl],
              },
            },
          }],
        }),
      }
    );

    const rsaPayload = (await rsaRes.json()) as Record<string, unknown>;
    const adId = rsaRes.ok
      ? String((rsaPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || '').split('/').pop()
      : undefined;

    if (!rsaRes.ok) {
      console.error('[one-click] Google RSA failed:', await extractError(rsaRes).catch(() => rsaPayload));
    }

    return {
      ok: true,
      campaignId,
      adId,
      message: `Google Ads campaign + ad group${adId ? ' + RSA' : ''} created (${activateImmediately ? 'ENABLED' : 'PAUSED'}). Budget: ${dailyBudget}/day.`,
      campaignStatus: activateImmediately ? 'Active' : 'Draft',
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
  strategy: OneClickStrategy,
  activateImmediately = false,
  country = 'US',
  product?: OneClickInput['product'],
  mediaBuffer?: Buffer,
  mediaMimeType?: string
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

    // Create campaign
    const metaStatus = activateImmediately ? 'ACTIVE' : 'PAUSED';
    const form = new URLSearchParams();
    form.set('name', sanitize(name));
    form.set('objective', toMetaObjective(objective));
    form.set('status', metaStatus);
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

    // Create ad set with daily budget — use LINK_CLICKS for all (no pixel/lead form required)
    const metaOptGoal = 'LINK_CLICKS';
    const adSetForm = new URLSearchParams();
    adSetForm.set('name', `${sanitize(name)} – Ad Set`);
    adSetForm.set('campaign_id', campaignId);
    adSetForm.set('status', metaStatus);
    adSetForm.set('billing_event', 'IMPRESSIONS');
    adSetForm.set('optimization_goal', metaOptGoal);
    adSetForm.set('daily_budget', String(Math.round(Math.max(dailyBudget, 1) * 100))); // in cents
    adSetForm.set('bid_strategy', 'LOWEST_COST_WITHOUT_CAP');
    adSetForm.set('targeting', JSON.stringify({
      age_min: 18,
      age_max: 65,
      publisher_platforms: ['facebook', 'instagram'],
      geo_locations: { countries: [country.toUpperCase()] },
    }));

    const adSetRes = await fetch(`${META_GRAPH_BASE}/${accountResource}/adsets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Bearer ${accessToken}`,
      },
      body: adSetForm.toString(),
    });

    if (!adSetRes.ok) {
      const adSetErr = await extractError(adSetRes);
      console.error('[one-click] Meta ad set failed:', adSetErr);
      return {
        ok: true,
        campaignId,
        message: `Meta campaign created (${metaStatus}). Ad set failed: ${adSetErr}`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }
    const adSetPayload = (await adSetRes.json()) as Record<string, unknown>;
    const adSetId = String(adSetPayload?.id || '');

    // 3. Fetch page ID (required for Ad Creative)
    const pageId = await fetchMetaPageId(accessToken);
    if (!pageId) {
      return {
        ok: true,
        campaignId,
        message: `Meta campaign + ad set created (${metaStatus}). No Facebook Page found — ad creative skipped.`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }

    // 4. Upload image — manual upload takes priority over WooCommerce URL
    const imageSource: string | Buffer | null = mediaBuffer ?? product?.imageUrl ?? null;
    let imageHash: string | null = null;
    if (imageSource) {
      imageHash = await uploadMetaImage(imageSource, accountResource, accessToken, mediaMimeType);
    }

    // 5. Create Ad Creative
    const adTitle = strategy.platformCopy?.Meta?.title || name;
    const adBody  = strategy.platformCopy?.Meta?.description || product?.description || '';
    const finalUrl = product?.url || '';

    const linkData: Record<string, unknown> = {
      link: finalUrl || 'https://facebook.com',
      name: sanitize(adTitle, 40),
      message: sanitize(adBody, 125),
      call_to_action: { type: toMetaCTA(objective), value: finalUrl ? { link: finalUrl } : {} },
    };
    if (imageHash) linkData.image_hash = imageHash;

    const creativeForm = new URLSearchParams();
    creativeForm.set('name', `${sanitize(name)} – Creative`);
    creativeForm.set('object_story_spec', JSON.stringify({
      page_id: pageId,
      link_data: linkData,
    }));

    const creativeRes = await fetch(`${META_GRAPH_BASE}/${accountResource}/adcreatives`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${accessToken}` },
      body: creativeForm.toString(),
    });

    if (!creativeRes.ok) {
      const creativeErr = await extractError(creativeRes);
      console.error('[one-click] Meta creative failed:', creativeErr);
      return {
        ok: true,
        campaignId,
        message: `Meta campaign + ad set created (${metaStatus}). Creative failed: ${creativeErr}`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }
    const creativePayload = (await creativeRes.json()) as Record<string, unknown>;
    const creativeId = String(creativePayload?.id || '');

    // 6. Create Ad
    const adForm = new URLSearchParams();
    adForm.set('name', sanitize(name));
    adForm.set('adset_id', adSetId);
    adForm.set('creative', JSON.stringify({ creative_id: creativeId }));
    adForm.set('status', metaStatus);

    const adRes = await fetch(`${META_GRAPH_BASE}/${accountResource}/ads`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${accessToken}` },
      body: adForm.toString(),
    });

    const adPayload = (await adRes.json()) as Record<string, unknown>;
    const adId = adRes.ok ? String(adPayload?.id || '') : undefined;

    if (!adRes.ok) {
      console.error('[one-click] Meta ad failed:', await extractError(adRes).catch(() => adPayload));
    }

    return {
      ok: true,
      campaignId,
      adId,
      message: `Meta campaign + ad set${adId ? ' + ad' : ''} created (${metaStatus}).${imageHash ? ' Image uploaded.' : ''}`,
      campaignStatus: activateImmediately ? 'Active' : 'Draft',
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
  strategy: OneClickStrategy,
  activateImmediately = false,
  country = 'US',
  product?: OneClickInput['product'],
  mediaBuffer?: Buffer,
  mediaMimeType?: string
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

    // Refresh token if expiring (only when a refresh token is available)
    const provider = new TikTokProvider();
    const expiresSoon =
      !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() <= Date.now() + 60_000;
    if (expiresSoon && connection.encryptedRefreshToken) {
      try {
        const refreshed = await provider.refreshToken({
          connectionId: connection.id,
          userId,
          encryptedRefreshToken: connection.encryptedRefreshToken,
        });
        await tokenService.saveTokenSet(userId, connection.id, refreshed);
      } catch (refreshErr) {
        console.warn('[one-click] TikTok token refresh failed, attempting with existing token:', refreshErr);
      }
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
        operation_status: activateImmediately ? 'ENABLE' : 'DISABLE',
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
        operation_status: activateImmediately ? 'ENABLE' : 'DISABLE',
        ...(TIKTOK_GEO[country.toUpperCase()] ? { location_ids: [TIKTOK_GEO[country.toUpperCase()]] } : {}),
      }),
    });

    const adGroupPayload = (await adGroupRes.json()) as Record<string, unknown>;
    const adGroupOk = adGroupRes.ok && Number(adGroupPayload?.code) === 0;
    const adGroupId = String(
      (adGroupPayload?.data as Record<string, unknown>)?.adgroup_id || ''
    );

    if (!adGroupOk || !adGroupId) {
      const adGroupErr = String(adGroupPayload?.message || '').trim() || `HTTP ${adGroupRes.status}`;
      console.error('[one-click] TikTok ad group failed:', adGroupErr);
      return {
        ok: true,
        campaignId,
        message: `TikTok campaign created (${activateImmediately ? 'ENABLED' : 'DISABLED'}). Ad group failed: ${adGroupErr}`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }

    // 3. Upload image — manual upload takes priority over WooCommerce URL
    const imageSource: string | Buffer | null = mediaBuffer ?? product?.imageUrl ?? null;
    let imageId: string | null = null;
    if (imageSource) {
      imageId = await uploadTikTokImage(imageSource, account.externalAccountId, accessToken, mediaMimeType);
    }

    if (!imageId) {
      // No image → cannot create TikTok Ad (video/image required)
      return {
        ok: true,
        campaignId,
        message: `TikTok campaign + ad group created (${activateImmediately ? 'ENABLED' : 'DISABLED'}). No image available — ad skipped.`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }

    // 4. Create Ad
    const adText = sanitize(strategy.platformCopy?.TikTok?.description || strategy.campaignName, 100);
    const finalUrl = product?.url || '';

    const adRes = await fetch(`${TIKTOK_API_BASE}/ad/create/`, {
      method: 'POST',
      headers: { 'Access-Token': accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({
        advertiser_id: account.externalAccountId,
        adgroup_id: adGroupId,
        creatives: [{
          ad_name: sanitize(name),
          ad_format: 'SINGLE_IMAGE',
          image_ids: [imageId],
          ad_text: adText,
          call_to_action: toTikTokCTA(objective),
          ...(finalUrl ? { landing_page_url: finalUrl } : {}),
        }],
      }),
    });

    const adPayload = (await adRes.json()) as Record<string, unknown>;
    const adOk = adRes.ok && Number(adPayload?.code) === 0;
    const adId = adOk
      ? String(((adPayload?.data as Record<string, unknown>)?.ad_ids as string[])?.[0] || '')
      : undefined;

    if (!adOk) {
      console.error('[one-click] TikTok ad failed:', String(adPayload?.message || ''));
    }

    return {
      ok: true,
      campaignId,
      adId,
      message: `TikTok campaign + ad group${adId ? ' + ad' : ''} created (${activateImmediately ? 'ENABLED' : 'DISABLED'}). Image uploaded.`,
      campaignStatus: activateImmediately ? 'Active' : 'Draft',
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
    Google: () => createGoogleDraft(user.id, campaignName, objective, dailyBudget, strategy, activateImmediately, input.country, input.product),
    Meta: () => createMetaDraft(user.id, campaignName, objective, dailyBudget, strategy, activateImmediately, input.country, input.product, mediaBuffer, mediaMimeType),
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
