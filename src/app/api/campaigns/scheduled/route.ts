import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { httpStatusFromError } from '@/src/lib/integrations/core/errors';
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
  shortTitle?: string;
  brief?: string;
  objective?: ObjectiveType;
  platforms?: PlatformName[];
  weeklySchedule?: WeeklySchedule;
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
  // Google Ads REST API requires YYYY-MM-DD format (not YYYYMMDD)
  return `${y}-${m}-${d}`;
};

const sanitizeName = (value: string) => value.trim().slice(0, 120);
const sanitizeAudienceName = (value: string) => value.trim().slice(0, 80);
const escapeGaqlLike = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

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

const normalizeAudienceInputs = (audiences: unknown): string[] => {
  if (!Array.isArray(audiences)) return [];
  const cleaned = audiences
    .map((item) => sanitizeAudienceName(String(item || '')))
    .filter((item) => item.length > 0);
  return [...new Set(cleaned)];
};

const applyGoogleAudiencesToCampaign = async (input: {
  customerId: string;
  campaignId: string;
  headers: Record<string, string>;
  audienceNames: string[];
}) => {
  let applied = 0;
  let failed = 0;
  const notes: string[] = [];
  for (const audienceName of input.audienceNames) {
    try {
      const searchResponse = await fetch(
        `${GOOGLE_ADS_API_BASE}/customers/${input.customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: input.headers,
          body: JSON.stringify({
            query: `
              SELECT user_list.resource_name, user_list.name
              FROM user_list
              WHERE user_list.status != 'REMOVED'
                AND user_list.name LIKE '%${escapeGaqlLike(audienceName)}%'
              LIMIT 1
            `,
          }),
        }
      );
      if (!searchResponse.ok) {
        failed += 1;
        notes.push(`Google audience lookup failed for "${audienceName}".`);
        continue;
      }
      const lookupPayload = (await searchResponse.json().catch(() => ({}))) as Record<string, any>;
      const userListResource = String(lookupPayload?.results?.[0]?.userList?.resourceName || '').trim();
      if (!userListResource) {
        failed += 1;
        notes.push(`Google user list not found for "${audienceName}".`);
        continue;
      }

      const criteriaResponse = await fetch(
        `${GOOGLE_ADS_API_BASE}/customers/${input.customerId}/campaignCriteria:mutate`,
        {
          method: 'POST',
          headers: input.headers,
          body: JSON.stringify({
            operations: [
              {
                create: {
                  campaign: `customers/${input.customerId}/campaigns/${input.campaignId}`,
                  userList: { userList: userListResource },
                },
              },
            ],
          }),
        }
      );
      if (!criteriaResponse.ok) {
        const message = (await extractErrorMessage(criteriaResponse)).toLowerCase();
        if (message.includes('already exists')) {
          applied += 1;
          continue;
        }
        failed += 1;
        notes.push(`Google audience apply failed for "${audienceName}".`);
        continue;
      }
      applied += 1;
    } catch {
      failed += 1;
      notes.push(`Google audience apply crashed for "${audienceName}".`);
    }
  }

  return { applied, failed, notes };
};

const createMetaSavedAudiences = async (input: {
  adAccountResource: string;
  accessToken: string;
  audienceNames: string[];
}) => {
  let created = 0;
  let failed = 0;
  const notes: string[] = [];
  for (const audienceName of input.audienceNames) {
    try {
      const form = new URLSearchParams();
      form.set('name', audienceName);
      form.set('description', `Created by BScale AI smart campaign`);
      form.set('targeting', JSON.stringify({ geo_locations: { countries: ['IL'] } }));
      form.set('access_token', input.accessToken);
      const response = await fetch(`${META_GRAPH_BASE}/${input.adAccountResource}/saved_audiences`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      if (!response.ok) {
        failed += 1;
        notes.push(`Meta saved audience failed for "${audienceName}".`);
        continue;
      }
      created += 1;
    } catch {
      failed += 1;
      notes.push(`Meta saved audience crashed for "${audienceName}".`);
    }
  }
  return { created, failed, notes };
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
                // Use target spend (maximize clicks) instead of deprecated manualCpc
                targetSpend: {},
                networkSettings: {
                  targetGoogleSearch: true,
                  targetSearchNetwork: false,
                  targetContentNetwork: false,
                },
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
    const audienceNames = normalizeAudienceInputs(body.audiences);
    if (audienceNames.length > 0) {
      const audienceResult = await applyGoogleAudiencesToCampaign({
        customerId,
        campaignId,
        headers,
        audienceNames,
      });
      const notesSuffix =
        audienceResult.notes.length > 0 ? ` ${audienceResult.notes.slice(0, 2).join(' ')}` : '';
      return {
        platform: 'Google',
        ok: true,
        campaignId,
        message: `Campaign created in Google Ads. Audiences applied: ${audienceResult.applied}/${audienceNames.length}.${notesSuffix}`,
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }
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
    const accessToken = await provider.getAccessTokenForConnection(connection.id, userId);
    const accountResource = account.externalAccountId.startsWith('act_')
      ? account.externalAccountId
      : `act_${account.externalAccountId}`;

    const form = new URLSearchParams();
    form.set('name', sanitizeName(body.campaignName || 'BScale Campaign'));
    form.set('objective', mapObjectiveToMeta((body.objective || 'sales') as ObjectiveType));
    form.set('status', activeNow ? 'ACTIVE' : 'PAUSED');
    form.set('buying_type', 'AUCTION');
    // Meta API v19+ requires special_ad_categories as a JSON-encoded array
    form.set('special_ad_categories', JSON.stringify([]));

    const response = await fetch(`${META_GRAPH_BASE}/${accountResource}/campaigns`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Bearer ${accessToken}`,
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
    const audienceNames = normalizeAudienceInputs(body.audiences);
    if (audienceNames.length > 0) {
      const audienceResult = await createMetaSavedAudiences({
        adAccountResource: accountResource,
        accessToken,
        audienceNames,
      });
      const notesSuffix =
        audienceResult.notes.length > 0 ? ` ${audienceResult.notes.slice(0, 2).join(' ')}` : '';
      return {
        platform: 'Meta',
        ok: true,
        campaignId: String(payload?.id || ''),
        message: `Campaign created in Meta Ads. Saved audiences created: ${audienceResult.created}/${audienceNames.length}.${notesSuffix}`,
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }
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
        userId,
        encryptedRefreshToken: connection.encryptedRefreshToken,
      });
      await tokenService.saveTokenSet(userId, connection.id, refreshed);
    }
    const accessToken = await tokenService.getAccessToken(connection.id, userId);

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
    const audienceNames = normalizeAudienceInputs(body.audiences);
    if (audienceNames.length > 0) {
      return {
        platform: 'TikTok',
        ok: true,
        campaignId,
        message:
          'Campaign created in TikTok Ads. Audience list sync is not available via this flow yet (requires TikTok DMP seed/source setup).',
        status: activeNow ? 'Scheduled' : 'Draft',
      };
    }
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
    const resolvedCampaignName = sanitizeName(
      String(
        body?.campaignName ||
          body?.shortTitle ||
          body?.brief?.slice(0, 80) ||
          'BScale Campaign'
      )
    );
    if (!resolvedCampaignName) {
      return NextResponse.json(
        {
          success: false,
          message: 'campaignName (or shortTitle) is required.',
        },
        { status: 400 }
      );
    }

    let platforms = (Array.isArray(body?.platforms) ? body?.platforms : []).filter(
      (platform): platform is PlatformName =>
        platform === 'Google' || platform === 'Meta' || platform === 'TikTok'
    );
    if (!platforms.length) {
      const [googleConnection, metaConnection, tiktokConnection] = await Promise.all([
        connectionService.getByUserPlatform(user.id, 'GOOGLE_ADS'),
        connectionService.getByUserPlatform(user.id, 'META'),
        connectionService.getByUserPlatform(user.id, 'TIKTOK'),
      ]);
      platforms = [
        googleConnection?.status === 'CONNECTED' ? 'Google' : null,
        metaConnection?.status === 'CONNECTED' ? 'Meta' : null,
        tiktokConnection?.status === 'CONNECTED' ? 'TikTok' : null,
      ].filter((value): value is PlatformName => Boolean(value));
    }
    if (!platforms.length) {
      return NextResponse.json(
        {
          success: false,
          message: 'No connected ad platforms were provided.',
        },
        { status: 400 }
      );
    }

    const normalizedBody: CreateScheduledCampaignBody = {
      ...(body || {}),
      campaignName: resolvedCampaignName,
      platforms,
    };

    const results: PlatformCreateResult[] = [];
    for (const platform of platforms) {
      if (platform === 'Google') {
        results.push(await createGoogleCampaign(user.id, normalizedBody));
      } else if (platform === 'Meta') {
        results.push(await createMetaCampaign(user.id, normalizedBody));
      } else if (platform === 'TikTok') {
        results.push(await createTikTokCampaign(user.id, normalizedBody));
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
      { status: httpStatusFromError(error) }
    );
  }
}
