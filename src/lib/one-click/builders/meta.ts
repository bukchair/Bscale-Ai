import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { META_GRAPH_BASE } from '@/src/lib/constants/api-urls';
import { sanitize, extractError } from '../shared';
import type {
  OneClickInput,
  OneClickObjective,
  OneClickStrategy,
  PlatformResult,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toMetaObjective = (o: OneClickObjective): string => {
  // Use traffic objective for reliability across accounts without pixel/lead-form setup.
  // This flow prioritizes publishing runnable ads over advanced conversion setup.
  if (o === 'sales') return 'OUTCOME_TRAFFIC';
  if (o === 'leads') return 'OUTCOME_TRAFFIC';
  return 'OUTCOME_TRAFFIC';
};

const toMetaCTA = (o: OneClickObjective) =>
  o === 'sales' ? 'SHOP_NOW' : 'LEARN_MORE';
const normalizeFinalUrl = (value: string | undefined): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
};

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

/** Upload image (URL or Buffer) to Meta ad account. Returns image hash or null. */
export const uploadMetaImage = async (
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

// ─── Builder ──────────────────────────────────────────────────────────────────

export const createMetaDraft = async (
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

    // 1. Create campaign
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

    // 2. Create ad set — LINK_CLICKS avoids pixel/lead-form requirements
    const adSetForm = new URLSearchParams();
    adSetForm.set('name', `${sanitize(name)} – Ad Set`);
    adSetForm.set('campaign_id', campaignId);
    adSetForm.set('status', metaStatus);
    adSetForm.set('billing_event', 'IMPRESSIONS');
    adSetForm.set('optimization_goal', 'LANDING_PAGE_VIEWS');
    adSetForm.set('bid_strategy', 'LOWEST_COST_WITHOUT_CAP');
    adSetForm.set('destination_type', 'WEBSITE');
    adSetForm.set('daily_budget', String(Math.round(Math.max(dailyBudget, 1) * 100)));
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
    const finalUrl = normalizeFinalUrl(product?.url);

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
      message: `Meta campaign + ad set${adId ? ' + ad' : ''} created (${metaStatus}). Budget: ${dailyBudget}/day.`,
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
