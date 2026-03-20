import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import { TikTokProvider } from '@/src/lib/integrations/providers/tiktok/provider';
import { TIKTOK_API_BASE } from '@/src/lib/constants/api-urls';
import { sanitize } from '../shared';
import type {
  OneClickInput,
  OneClickObjective,
  OneClickStrategy,
  PlatformResult,
} from '../types';

// Country code → TikTok location ID (GeoNames-based)
const TIKTOK_GEO: Record<string, string> = {
  US: '6252001', GB: '2635167', DE: '2921044', FR: '3017382',
  CA: '6251999', AU: '2077456', NL: '2750405', IL: '294640',
  ES: '2510769', IT: '3175395',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toTikTokObjective = (o: OneClickObjective): string => {
  if (o === 'sales') return 'CONVERSIONS';
  if (o === 'leads') return 'LEAD_GENERATION';
  return 'TRAFFIC';
};

const toTikTokCTA = (o: OneClickObjective) =>
  o === 'sales' ? 'SHOP_NOW' : 'LEARN_MORE';

const toTikTokOptimizationGoal = (o: OneClickObjective) => {
  if (o === 'sales') return 'CONVERT';
  if (o === 'leads') return 'LEAD_GENERATION';
  return 'CLICK';
};

const toTikTokBillingEvent = (o: OneClickObjective) =>
  o === 'traffic' ? 'CPC' : 'OCPM';

/** Upload image (URL or Buffer) to TikTok ad library. Returns image_id or null. */
export const uploadTikTokImage = async (
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

// ─── Builder ──────────────────────────────────────────────────────────────────

export const createTikTokDraft = async (
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

    // 1. Create campaign
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

    // 2. Create Ad Group
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
