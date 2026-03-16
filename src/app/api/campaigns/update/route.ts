import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { TikTokProvider } from '@/src/lib/integrations/providers/tiktok/provider';
import { GOOGLE_ADS_API_BASE, META_GRAPH_BASE, TIKTOK_API_BASE } from '@/src/lib/constants/api-urls';

const updateCampaignSchema = z.object({
  platform: z.enum(['Google', 'Meta', 'TikTok']),
  campaignId: z.string().min(1),
  name: z.string().min(1).max(120),
  status: z.enum(['Active', 'Paused']),
  dailyBudget: z.number().finite().nonnegative().nullable().optional(),
});

type PlatformName = 'Google' | 'Meta' | 'TikTok';
type UiStatus = 'Active' | 'Paused';
type UpdateCampaignBody = z.infer<typeof updateCampaignSchema>;

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
    const parsed = JSON.parse(raw) as Record<string, unknown>;
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

const updateGoogleCampaign = async (
  userId: string,
  body: Required<Pick<UpdateCampaignBody, 'campaignId' | 'name' | 'status'>> & { dailyBudget?: number | null }
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

  const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
    'content-type': 'application/json',
  };
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

  const updatePaths = ['name', 'status'];
  const campaignUpdate: Record<string, unknown> = {
    resourceName: `customers/${customerId}/campaigns/${campaignId}`,
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

  return {
    platform: 'Google' as const,
    campaignId,
    name: String(campaignUpdate.name || ''),
    status: body.status,
  };
};

const updateMetaCampaign = async (
  userId: string,
  body: Required<Pick<UpdateCampaignBody, 'campaignId' | 'name' | 'status'>> & { dailyBudget?: number | null }
) => {
  const connection = await connectionService.getByUserPlatform(userId, 'META');
  if (!connection || connection.status !== 'CONNECTED') {
    throw new Error('Meta connection is not active.');
  }

  const provider = new MetaProvider();
  const accessToken = await provider.getAccessTokenForConnection(connection.id);
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
  form.set('access_token', accessToken);

  const response = await fetch(`${META_GRAPH_BASE}/${campaignId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return {
    platform: 'Meta' as const,
    campaignId,
    name: body.name.trim().slice(0, 120),
    status: body.status,
  };
};

const updateTikTokCampaign = async (
  userId: string,
  body: Required<Pick<UpdateCampaignBody, 'campaignId' | 'name' | 'status'>> & { dailyBudget?: number | null }
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
      encryptedRefreshToken: connection.encryptedRefreshToken,
    });
    await tokenService.saveTokenSet(userId, connection.id, refreshed);
  }
  const accessToken = await tokenService.getAccessToken(connection.id);
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

  return {
    platform: 'TikTok' as const,
    campaignId,
    name: body.name.trim().slice(0, 120),
    status: body.status,
  };
};

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const rawBody = await request.json().catch(() => null);
    const parseResult = updateCampaignSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.issues[0]?.message ?? 'Invalid request body.' },
        { status: 400 }
      );
    }

    const body: UpdateCampaignBody = parseResult.data;
    const payload = {
      campaignId: body.campaignId,
      name: body.name,
      status: body.status as UiStatus,
      dailyBudget:
        typeof body.dailyBudget === 'number' && Number.isFinite(body.dailyBudget)
          ? Math.max(0, body.dailyBudget)
          : null,
    };

    let updated: { platform: PlatformName; campaignId: string; name: string; status: UiStatus };
    if (body.platform === 'Google') {
      updated = await updateGoogleCampaign(user.id, payload);
    } else if (body.platform === 'Meta') {
      updated = await updateMetaCampaign(user.id, payload);
    } else {
      updated = await updateTikTokCampaign(user.id, payload);
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `${updated.platform} campaign updated successfully.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update campaign.',
      },
      { status: 500 }
    );
  }
}
