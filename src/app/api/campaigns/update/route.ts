import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { httpStatusFromError } from '@/src/lib/integrations/core/errors';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { TikTokProvider } from '@/src/lib/integrations/providers/tiktok/provider';

type PlatformName = 'Google' | 'Meta' | 'TikTok';
type UiStatus = 'Active' | 'Paused';

type UpdateCampaignBody = {
  platform?: PlatformName;
  campaignId?: string;
  name?: string;
  status?: UiStatus;
  dailyBudget?: number | null;
  applyToAds?: boolean;
};

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v22';
const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

const toGoogleStatus = (status: UiStatus) => (status === 'Active' ? 'ENABLED' : 'PAUSED');
const toMetaStatus = (status: UiStatus) => (status === 'Active' ? 'ACTIVE' : 'PAUSED');
const toTikTokStatus = (status: UiStatus) => (status === 'Active' ? 'ENABLE' : 'DISABLE');

const normalizeCampaignId = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('/campaigns/')) {
    const parts = raw.split('/campaigns/');
    return parts[parts.length - 1] || raw;
  }
  return raw;
};

const extractErrorMessage = async (response: Response) => {
  const raw = await response.text();
  if (!raw) return `Request failed with status ${response.status}`;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; details?: Array<{ message?: string }> }; message?: string; data?: { message?: string } };
    return (
      parsed?.error?.message ||
      parsed?.error?.details?.[0]?.message ||
      parsed?.message ||
      parsed?.data?.message ||
      raw.slice(0, 260)
    );
  } catch {
    return raw.slice(0, 260);
  }
};

const buildGoogleHeaders = (
  accessToken: string,
  loginCustomerId?: string
): Record<string, string> => {
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
    'content-type': 'application/json',
  };
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
  return headers;
};

const updateGoogleAdsInCampaign = async (input: {
  customerId: string;
  campaignId: string;
  status: UiStatus;
  headers: Record<string, string>;
}) => {
  const searchResponse = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${input.customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: input.headers,
      body: JSON.stringify({
        query: `
          SELECT ad_group_ad.resource_name
          FROM ad_group_ad
          WHERE campaign.id = ${input.campaignId}
            AND ad_group_ad.status != 'REMOVED'
          LIMIT 500
        `,
      }),
    }
  );
  if (!searchResponse.ok) {
    throw new Error(await extractErrorMessage(searchResponse));
  }
  const searchPayload = (await searchResponse.json().catch(() => ({}))) as Record<string, unknown>;
  const resourceNames = (Array.isArray(searchPayload?.results) ? searchPayload.results : [])
    .map((row: Record<string, unknown>) => String((row?.adGroupAd as Record<string, unknown>)?.resourceName || '').trim())
    .filter(Boolean);
  if (resourceNames.length === 0) {
    return { updatedAdsCount: 0, adsUpdateFailures: 0 };
  }

  const chunkSize = 200;
  let updatedAdsCount = 0;
  let adsUpdateFailures = 0;
  for (let offset = 0; offset < resourceNames.length; offset += chunkSize) {
    const chunk = resourceNames.slice(offset, offset + chunkSize);
    const mutateResponse = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${input.customerId}/adGroupAds:mutate`,
      {
        method: 'POST',
        headers: input.headers,
        body: JSON.stringify({
          operations: chunk.map((resourceName) => ({
            update: {
              resourceName,
              status: toGoogleStatus(input.status),
            },
            updateMask: 'status',
          })),
        }),
      }
    );
    if (!mutateResponse.ok) {
      adsUpdateFailures += chunk.length;
      continue;
    }
    const mutatePayload = (await mutateResponse.json().catch(() => ({}))) as Record<string, unknown>;
    const updatedInChunk = Array.isArray(mutatePayload?.results)
      ? mutatePayload.results.length
      : chunk.length;
    updatedAdsCount += updatedInChunk;
  }

  return { updatedAdsCount, adsUpdateFailures };
};

const updateGoogleCampaign = async (
  userId: string,
  body: Required<Pick<UpdateCampaignBody, 'campaignId' | 'name' | 'status'>> & {
    dailyBudget?: number | null;
    applyToAds?: boolean;
  }
) => {
  if (!integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is missing.');
  }

  const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
    userId,
    'GOOGLE_ADS'
  );
  const customerId = googleLegacyBridge.pickSelectedAccountId(connection);
  if (!customerId) {
    throw new Error('No selected Google Ads account found.');
  }
  const campaignId = normalizeCampaignId(body.campaignId);
  if (!campaignId) {
    throw new Error('Invalid Google campaign id.');
  }
  const numericCampaignId = Number(String(campaignId).replace(/\D/g, ''));
  if (!Number.isFinite(numericCampaignId) || numericCampaignId <= 0) {
    throw new Error('Google campaign id must be numeric.');
  }

  const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
  const headers = buildGoogleHeaders(accessToken, loginCustomerId);

  const updatePaths = ['name', 'status'];
  const campaignUpdate: Record<string, unknown> = {
    resourceName: `customers/${customerId}/campaigns/${numericCampaignId}`,
    name: body.name.trim().slice(0, 120),
    status: toGoogleStatus(body.status),
  };

  const response = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operations: [
        {
          update: campaignUpdate,
          updateMask: updatePaths.join(','),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  if (typeof body.dailyBudget === 'number' && Number.isFinite(body.dailyBudget) && body.dailyBudget > 0) {
    const budgetLookupResponse = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `
            SELECT campaign.campaign_budget
            FROM campaign
            WHERE campaign.id = ${numericCampaignId}
            LIMIT 1
          `,
        }),
      }
    );
    if (!budgetLookupResponse.ok) {
      throw new Error(await extractErrorMessage(budgetLookupResponse));
    }
    const budgetLookupPayload = (await budgetLookupResponse.json().catch(() => ({}))) as Record<string, unknown>;
    const budgetResourceName = String(
      budgetLookupPayload?.results?.[0]?.campaign?.campaignBudget || ''
    ).trim();
    if (budgetResourceName) {
      const budgetUpdateResponse = await fetch(
        `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignBudgets:mutate`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            operations: [
              {
                update: {
                  resourceName: budgetResourceName,
                  amountMicros: Math.round(body.dailyBudget * 1_000_000),
                },
                updateMask: 'amount_micros',
              },
            ],
          }),
        }
      );
      if (!budgetUpdateResponse.ok) {
        throw new Error(await extractErrorMessage(budgetUpdateResponse));
      }
    }
  }

  let adsSummary = { updatedAdsCount: 0, adsUpdateFailures: 0 };
  if (body.applyToAds) {
    adsSummary = await updateGoogleAdsInCampaign({
      customerId,
      campaignId: String(numericCampaignId),
      status: body.status,
      headers,
    });
  }

  return {
    platform: 'Google' as const,
    campaignId: String(numericCampaignId),
    name: String(campaignUpdate.name || ''),
    status: body.status,
    updatedAdsCount: adsSummary.updatedAdsCount,
    adsUpdateFailures: adsSummary.adsUpdateFailures,
  };
};

const updateMetaCampaign = async (
  userId: string,
  body: Required<Pick<UpdateCampaignBody, 'campaignId' | 'name' | 'status'>> & {
    dailyBudget?: number | null;
    applyToAds?: boolean;
  }
) => {
  const connection = await connectionService.getByUserPlatform(userId, 'META');
  if (!connection || connection.status !== 'CONNECTED') {
    throw new Error('Meta connection is not active.');
  }

  const provider = new MetaProvider();
  const accessToken = await provider.getAccessTokenForConnection(connection.id, userId);
  const campaignId = normalizeCampaignId(body.campaignId);
  if (!campaignId) {
    throw new Error('Invalid Meta campaign id.');
  }

  const form = new URLSearchParams();
  form.set('name', body.name.trim().slice(0, 120));
  form.set('status', toMetaStatus(body.status));
  if (typeof body.dailyBudget === 'number' && Number.isFinite(body.dailyBudget) && body.dailyBudget > 0) {
    form.set('daily_budget', String(Math.round(body.dailyBudget * 100)));
  }

  const response = await fetch(`${META_GRAPH_BASE}/${campaignId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Bearer ${accessToken}`,
    },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  let updatedAdsCount = 0;
  let adsUpdateFailures = 0;
  if (body.applyToAds) {
    const adsUrl = new URL(`${META_GRAPH_BASE}/${campaignId}/ads`);
    adsUrl.searchParams.set('fields', 'id,status');
    adsUrl.searchParams.set('limit', '200');
    const adsResponse = await fetch(adsUrl, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (adsResponse.ok) {
      const adsPayload = (await adsResponse.json().catch(() => ({}))) as Record<string, unknown>;
      const adIds = (Array.isArray(adsPayload?.data) ? adsPayload.data : [])
        .map((ad: Record<string, unknown>) => String(ad?.id || '').trim())
        .filter(Boolean);
      for (const adId of adIds) {
        const adForm = new URLSearchParams();
        adForm.set('status', toMetaStatus(body.status));
        const adUpdateResponse = await fetch(`${META_GRAPH_BASE}/${adId}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: `Bearer ${accessToken}`,
          },
          body: adForm.toString(),
        });
        if (adUpdateResponse.ok) updatedAdsCount += 1;
        else adsUpdateFailures += 1;
      }
    } else {
      adsUpdateFailures += 1;
    }
  }

  return {
    platform: 'Meta' as const,
    campaignId,
    name: body.name.trim().slice(0, 120),
    status: body.status,
    updatedAdsCount,
    adsUpdateFailures,
  };
};

const updateTikTokCampaign = async (
  userId: string,
  body: Required<Pick<UpdateCampaignBody, 'campaignId' | 'name' | 'status'>> & {
    dailyBudget?: number | null;
    applyToAds?: boolean;
  }
) => {
  const connection = await connectionService.getByUserPlatform(userId, 'TIKTOK');
  if (!connection || connection.status !== 'CONNECTED') {
    throw new Error('TikTok connection is not active.');
  }

  const account =
    connection.connectedAccounts.find((item) => item.isSelected) ||
    connection.connectedAccounts[0];
  if (!account?.externalAccountId) {
    throw new Error('No selected TikTok advertiser found.');
  }

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
  const campaignId = normalizeCampaignId(body.campaignId);
  if (!campaignId) {
    throw new Error('Invalid TikTok campaign id.');
  }

  const payload: Record<string, unknown> = {
    advertiser_id: account.externalAccountId,
    campaign_id: campaignId,
    campaign_name: body.name.trim().slice(0, 120),
    operation_status: toTikTokStatus(body.status),
  };
  if (typeof body.dailyBudget === 'number' && Number.isFinite(body.dailyBudget) && body.dailyBudget > 0) {
    payload.budget_mode = 'BUDGET_MODE_DAY';
    payload.budget = body.dailyBudget;
  }

  const response = await fetch(`${TIKTOK_API_BASE}/campaign/update/`, {
    method: 'POST',
    headers: {
      'Access-Token': accessToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || Number(parsed?.code) !== 0) {
    throw new Error(String(parsed?.message || `TikTok update failed (${response.status}).`));
  }

  let updatedAdsCount = 0;
  let adsUpdateFailures = 0;
  if (body.applyToAds) {
    const adsListResponse = await fetch(`${TIKTOK_API_BASE}/ad/get/`, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        advertiser_id: account.externalAccountId,
        page: 1,
        page_size: 200,
        filtering: {
          campaign_ids: [campaignId],
        },
      }),
    });
    const adsListPayload = (await adsListResponse.json().catch(() => null)) as Record<string, unknown> | null;
    if (adsListResponse.ok && Number(adsListPayload?.code) === 0) {
      const adsListData = adsListPayload?.data as Record<string, unknown> | undefined;
      const adRows = Array.isArray(adsListData?.list) ? (adsListData!.list as Record<string, unknown>[]) : [];
      for (const adRow of adRows) {
        const adId = String(adRow?.ad_id || adRow?.id || '').trim();
        if (!adId) continue;
        const adUpdateResponse = await fetch(`${TIKTOK_API_BASE}/ad/update/`, {
          method: 'POST',
          headers: {
            'Access-Token': accessToken,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            advertiser_id: account.externalAccountId,
            ad_id: adId,
            operation_status: toTikTokStatus(body.status),
          }),
        });
        const adUpdatePayload = (await adUpdateResponse.json().catch(() => null)) as Record<string, unknown> | null;
        if (adUpdateResponse.ok && Number(adUpdatePayload?.code) === 0) updatedAdsCount += 1;
        else adsUpdateFailures += 1;
      }
    } else {
      adsUpdateFailures += 1;
    }
  }

  return {
    platform: 'TikTok' as const,
    campaignId,
    name: body.name.trim().slice(0, 120),
    status: body.status,
    updatedAdsCount,
    adsUpdateFailures,
  };
};

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json().catch(() => null)) as UpdateCampaignBody | null;
    if (!body?.platform || !body?.campaignId || !body?.name || !body?.status) {
      return NextResponse.json(
        {
          success: false,
          message: 'platform, campaignId, name, and status are required.',
        },
        { status: 400 }
      );
    }
    if (!['Google', 'Meta', 'TikTok'].includes(body.platform)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unsupported platform for campaign update.',
        },
        { status: 400 }
      );
    }
    if (!['Active', 'Paused'].includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          message: 'status must be Active or Paused.',
        },
        { status: 400 }
      );
    }

    const payload = {
      campaignId: body.campaignId,
      name: body.name,
      status: body.status as UiStatus,
      dailyBudget:
        typeof body.dailyBudget === 'number' && Number.isFinite(body.dailyBudget)
          ? Math.max(0, body.dailyBudget)
          : null,
      applyToAds: Boolean(body.applyToAds),
    };

    let updated: {
      platform: PlatformName;
      campaignId: string;
      name: string;
      status: UiStatus;
      updatedAdsCount?: number;
      adsUpdateFailures?: number;
    };
    if (body.platform === 'Google') {
      updated = await updateGoogleCampaign(user.id, payload);
    } else if (body.platform === 'Meta') {
      updated = await updateMetaCampaign(user.id, payload);
    } else {
      updated = await updateTikTokCampaign(user.id, payload);
    }

    const adsMsg =
      payload.applyToAds
        ? ` Ads updated: ${updated.updatedAdsCount || 0}${
            (updated.adsUpdateFailures || 0) > 0
              ? ` (failures: ${updated.adsUpdateFailures || 0})`
              : ''
          }.`
        : '';

    return NextResponse.json({
      success: true,
      updated,
      message: `${updated.platform} campaign updated successfully.${adsMsg}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update campaign.',
      },
      { status: httpStatusFromError(error) }
    );
  }
}
