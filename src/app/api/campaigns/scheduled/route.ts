import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { TikTokProvider } from '@/src/lib/integrations/providers/tiktok/provider';
import { GOOGLE_ADS_API_BASE, META_GRAPH_BASE, TIKTOK_API_BASE } from '@/src/lib/constants/api-urls';

type ObjectiveType = 'sales' | 'traffic' | 'leads' | 'awareness' | 'retargeting';
type PlatformName = 'Google' | 'Meta' | 'TikTok';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type WeeklySchedule = Record<string, Record<DayKey, number[]>>;

type CreateScheduledCampaignBody = {
  campaignName?: string;
  objective?: ObjectiveType;
  platforms?: PlatformName[];
  weeklySchedule?: WeeklySchedule;
  shortTitle?: string;
  brief?: string;
  audiences?: string[];
  contentType?: string;
  productType?: string;
  serviceType?: string;
};

type PlatformCreateResult = {
  platform: PlatformName;
  ok: boolean;
  campaignId?: string;
  message: string;
  status: 'Scheduled' | 'Draft';
};

const DAY_BY_JS: Record<number, DayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

const mapObjectiveToMeta = (objective: ObjectiveType) => {
  if (objective === 'sales') return 'OUTCOME_SALES';
  if (objective === 'traffic') return 'OUTCOME_TRAFFIC';
  if (objective === 'leads') return 'OUTCOME_LEADS';
  if (objective === 'awareness') return 'OUTCOME_AWARENESS';
  return 'OUTCOME_ENGAGEMENT';
};

const mapObjectiveToTikTok = (objective: ObjectiveType) => {
  if (objective === 'sales') return 'CONVERSIONS';
  if (objective === 'leads') return 'LEAD_GENERATION';
  if (objective === 'traffic') return 'TRAFFIC';
  if (objective === 'retargeting') return 'CONVERSIONS';
  return 'REACH';
};

const todayYmd = () => {
  const date = new Date();
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}${m}${d}`;
};

const sanitizeName = (value: string) => value.trim().slice(0, 120);

const extractErrorMessage = async (response: Response) => {
  const raw = await response.text();
  if (!raw) return `Request failed with status ${response.status}`;
  try {
    const parsed = JSON.parse(raw) as Record<string, any>;
    return (
      parsed?.error?.message ||
      parsed?.message ||
      parsed?.data?.message ||
      raw.slice(0, 280)
    );
  } catch {
    return raw.slice(0, 280);
  }
};

const isHourActiveForPlatform = (schedule: WeeklySchedule | undefined, platform: PlatformName) => {
  const platformSchedule = schedule?.[platform];
  if (!platformSchedule) return false;
  const now = new Date();
  const day = DAY_BY_JS[now.getDay()];
  const hour = now.getHours();
  const activeHours = Array.isArray(platformSchedule[day]) ? platformSchedule[day] : [];
  return activeHours.includes(hour);
};

const createGoogleCampaign = async (
  userId: string,
  body: CreateScheduledCampaignBody
): Promise<PlatformCreateResult> => {
  const activeNow = isHourActiveForPlatform(body.weeklySchedule, 'Google');
  const defaultBudget = 20;
  try {
    if (!integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
      return {
        platform: 'Google',
        ok: false,
        message: 'GOOGLE_ADS_DEVELOPER_TOKEN is missing.',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }

    const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
      userId,
      'GOOGLE_ADS'
    );
    const customerId = googleLegacyBridge.pickSelectedAccountId(connection);
    if (!customerId) {
      return {
        platform: 'Google',
        ok: false,
        message: 'No selected Google Ads account found.',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }

    const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const budgetResponse = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignBudgets:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: `${sanitizeName(body.campaignName || 'BScale Campaign')} Budget ${Date.now()}`,
                amountMicros: Math.round(defaultBudget * 1_000_000),
                deliveryMethod: 'STANDARD',
                explicitlyShared: false,
              },
            },
          ],
        }),
      }
    );

    if (!budgetResponse.ok) {
      return {
        platform: 'Google',
        ok: false,
        message: await extractErrorMessage(budgetResponse),
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }
    const budgetPayload = (await budgetResponse.json()) as Record<string, any>;
    const campaignBudgetResourceName = budgetPayload?.results?.[0]?.resourceName;
    if (!campaignBudgetResourceName) {
      return {
        platform: 'Google',
        ok: false,
        message: 'Google budget created without resource name.',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }

    const campaignResponse = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [
            {
              create: {
                name: sanitizeName(body.campaignName || 'BScale Campaign'),
                status: activeNow ? 'ENABLED' : 'PAUSED',
                advertisingChannelType: 'SEARCH',
                campaignBudget: campaignBudgetResourceName,
                manualCpc: {},
                startDate: todayYmd(),
              },
            },
          ],
        }),
      }
    );

    if (!campaignResponse.ok) {
      return {
        platform: 'Google',
        ok: false,
        message: await extractErrorMessage(campaignResponse),
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }
    const campaignPayload = (await campaignResponse.json()) as Record<string, any>;
    const resourceName = String(campaignPayload?.results?.[0]?.resourceName || '');
    const campaignId = resourceName.split('/').pop() || resourceName;
    return {
      platform: 'Google',
      ok: true,
      campaignId,
      message: 'Campaign created in Google Ads.',
      status: activeNow ? 'Scheduled' : 'Draft',
    };
  } catch (error) {
    return {
      platform: 'Google',
      ok: false,
      message: error instanceof Error ? error.message : 'Google campaign creation failed.',
      status: activeNow ? 'Scheduled' : 'Draft',
    };
  }
};

const createMetaCampaign = async (
  userId: string,
  body: CreateScheduledCampaignBody
): Promise<PlatformCreateResult> => {
  const activeNow = isHourActiveForPlatform(body.weeklySchedule, 'Meta');
  try {
    const connection = await connectionService.getByUserPlatform(userId, 'META');
    if (!connection || connection.status !== 'CONNECTED') {
      return {
        platform: 'Meta',
        ok: false,
        message: 'Meta connection is not active.',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }

    const account =
      connection.connectedAccounts.find((item) => item.isSelected) ||
      connection.connectedAccounts[0];
    if (!account?.externalAccountId) {
      return {
        platform: 'Meta',
        ok: false,
        message: 'No selected Meta ad account found.',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }

    const provider = new MetaProvider();
    const accessToken = await provider.getAccessTokenForConnection(connection.id);
    const accountResource = account.externalAccountId.startsWith('act_')
      ? account.externalAccountId
      : `act_${account.externalAccountId}`;

    const form = new URLSearchParams();
    form.set('name', sanitizeName(body.campaignName || 'BScale Campaign'));
    form.set('objective', mapObjectiveToMeta((body.objective || 'sales') as ObjectiveType));
    form.set('status', activeNow ? 'ACTIVE' : 'PAUSED');
    form.set('special_ad_categories', '[]');
    form.set('access_token', accessToken);

    const response = await fetch(`${META_GRAPH_BASE}/${accountResource}/campaigns`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!response.ok) {
      return {
        platform: 'Meta',
        ok: false,
        message: await extractErrorMessage(response),
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }
    const payload = (await response.json()) as Record<string, any>;
    return {
      platform: 'Meta',
      ok: true,
      campaignId: String(payload?.id || ''),
      message: 'Campaign created in Meta Ads.',
      status: activeNow ? 'Scheduled' : 'Draft',
    };
  } catch (error) {
    return {
      platform: 'Meta',
      ok: false,
      message: error instanceof Error ? error.message : 'Meta campaign creation failed.',
      status: activeNow ? 'Scheduled' : 'Draft',
    };
  }
};

const createTikTokCampaign = async (
  userId: string,
  body: CreateScheduledCampaignBody
): Promise<PlatformCreateResult> => {
  const activeNow = isHourActiveForPlatform(body.weeklySchedule, 'TikTok');
  const defaultBudget = 20;
  try {
    const connection = await connectionService.getByUserPlatform(userId, 'TIKTOK');
    if (!connection || connection.status !== 'CONNECTED') {
      return {
        platform: 'TikTok',
        ok: false,
        message: 'TikTok connection is not active.',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }

    const account =
      connection.connectedAccounts.find((item) => item.isSelected) ||
      connection.connectedAccounts[0];
    if (!account?.externalAccountId) {
      return {
        platform: 'TikTok',
        ok: false,
        message: 'No selected TikTok advertiser found.',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
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

    const response = await fetch(`${TIKTOK_API_BASE}/campaign/create/`, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        advertiser_id: account.externalAccountId,
        campaign_name: sanitizeName(body.campaignName || 'BScale Campaign'),
        objective_type: mapObjectiveToTikTok((body.objective || 'sales') as ObjectiveType),
        budget_mode: 'BUDGET_MODE_DAY',
        budget: defaultBudget,
        operation_status: activeNow ? 'ENABLE' : 'DISABLE',
      }),
    });

    const payload = (await response.json()) as Record<string, any>;
    if (!response.ok || Number(payload?.code) !== 0) {
      return {
        platform: 'TikTok',
        ok: false,
        message:
          String(payload?.message || '').trim() ||
          `TikTok campaign creation failed (${response.status}).`,
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }
    const campaignId = String(
      payload?.data?.campaign_id || payload?.data?.campaignId || payload?.request_id || ''
    );
    return {
      platform: 'TikTok',
      ok: true,
      campaignId,
      message: 'Campaign created in TikTok Ads.',
      status: activeNow ? 'Scheduled' : 'Draft',
    };
  } catch (error) {
    return {
      platform: 'TikTok',
      ok: false,
      message: error instanceof Error ? error.message : 'TikTok campaign creation failed.',
      status: activeNow ? 'Scheduled' : 'Draft',
    };
  }
};

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json().catch(() => null)) as CreateScheduledCampaignBody | null;
    if (!body?.campaignName || !Array.isArray(body.platforms) || body.platforms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'campaignName and platforms are required.',
        },
        { status: 400 }
      );
    }

    const platforms = body.platforms.filter(
      (platform): platform is PlatformName =>
        platform === 'Google' || platform === 'Meta' || platform === 'TikTok'
    );
    if (!platforms.length) {
      return NextResponse.json(
        {
          success: false,
          message: 'No valid platforms were provided.',
        },
        { status: 400 }
      );
    }

    const results: PlatformCreateResult[] = [];
    for (const platform of platforms) {
      if (platform === 'Google') {
        results.push(await createGoogleCampaign(user.id, body));
      } else if (platform === 'Meta') {
        results.push(await createMetaCampaign(user.id, body));
      } else if (platform === 'TikTok') {
        results.push(await createTikTokCampaign(user.id, body));
      }
    }

    const successCount = results.filter((item) => item.ok).length;
    return NextResponse.json(
      {
        success: successCount > 0,
        createdCount: successCount,
        failedCount: results.length - successCount,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create scheduled campaigns.',
      },
      { status: 500 }
    );
  }
}
