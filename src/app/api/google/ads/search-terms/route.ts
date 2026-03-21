import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { httpStatusFromError } from '@/src/lib/integrations/core/errors';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';

import { GOOGLE_ADS_API_BASE } from '@/src/lib/constants/api-urls';
import { toApiErrorMessage, normalizeDateParam, normalizeCustomerId } from '@/src/lib/utils/api-request-utils';
const normalizeMatchType = (value: unknown): 'BROAD' | 'PHRASE' | 'EXACT' => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'BROAD' || normalized === 'EXACT') return normalized;
  return 'PHRASE';
};
const normalizeKeywordTerm = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
const normalizeCampaignId = (value: unknown) => normalizeCustomerId(String(value || ''));

type GoogleAdsContext = {
  accessToken: string;
  customerId: string;
  loginCustomerId?: string;
};

const resolveGoogleAdsContext = async (
  request: Request,
  overrides?: { customerId?: string; loginCustomerId?: string }
): Promise<GoogleAdsContext> => {
  if (!integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is missing.');
  }

  const user = await requireAuthenticatedUser();
  const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
    user.id,
    'GOOGLE_ADS'
  );
  const url = new URL(request.url);
  const queryCustomerId = normalizeCustomerId(
    overrides?.customerId || url.searchParams.get('customer_id') || ''
  );
  const fallbackCustomerId = googleLegacyBridge.pickSelectedAccountId(connection);
  const customerId = queryCustomerId || fallbackCustomerId;
  if (!customerId) {
    throw new Error('Missing customer_id for Google Ads search terms.');
  }

  const queryLoginCustomerId = normalizeCustomerId(
    overrides?.loginCustomerId || url.searchParams.get('login_customer_id') || ''
  );
  const loginCustomerId =
    queryLoginCustomerId || googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;

  return {
    accessToken,
    customerId,
    loginCustomerId,
  };
};

const parseJsonResponse = async (response: Response) => {
  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = null;
  }
  return {
    raw,
    parsed,
  };
};

const toErrorMessage = toApiErrorMessage;

export async function GET(request: Request) {
  try {
    const { accessToken, customerId, loginCustomerId } = await resolveGoogleAdsContext(request);
    const url = new URL(request.url);
    const startDate = normalizeDateParam(url.searchParams.get('start_date'));
    const endDate = normalizeDateParam(url.searchParams.get('end_date'));
    const dateFilter =
      startDate && endDate ? `\n              AND segments.date BETWEEN '${startDate}' AND '${endDate}'` : '';

    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const response = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `
          SELECT
            search_term_view.search_term,
            campaign.id,
            campaign.name,
            ad_group.id,
            ad_group.name,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM search_term_view
          WHERE metrics.impressions > 0${dateFilter}
          ORDER BY metrics.clicks DESC
          LIMIT 500
        `,
      }),
    });

    const raw = await response.text();
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: toErrorMessage(response.status, raw, parsed) },
        { status: response.status }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Failed to load Google Ads search terms for this user.',
      },
      { status: httpStatusFromError(error) }
    );
  }
}

type NegativeKeywordOperationInput = {
  term?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  matchType?: 'BROAD' | 'PHRASE' | 'EXACT';
};

type NegativeKeywordRequestBody = {
  customerId?: string;
  loginCustomerId?: string;
  scope?: 'campaign' | 'ad_group' | 'shared_list';
  sharedListName?: string;
  items?: NegativeKeywordOperationInput[];
};

const normalizeScope = (value: unknown): 'campaign' | 'ad_group' | 'shared_list' => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'ad_group') return 'ad_group';
  if (normalized === 'shared_list') return 'shared_list';
  return 'campaign';
};

const normalizeSharedListName = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);

const buildGoogleAdsHeaders = (
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

const googleAdsMutate = async (
  customerId: string,
  accessToken: string,
  loginCustomerId: string | undefined,
  endpoint: string,
  body: Record<string, unknown>
) => {
  const response = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/${endpoint}`, {
    method: 'POST',
    headers: buildGoogleAdsHeaders(accessToken, loginCustomerId),
    body: JSON.stringify(body),
  });
  const { raw, parsed } = await parseJsonResponse(response);
  return { response, raw, parsed };
};

const lookupOrCreateSharedSet = async (
  customerId: string,
  accessToken: string,
  loginCustomerId: string | undefined,
  listName: string
) => {
  const lookup = await googleAdsMutate(customerId, accessToken, loginCustomerId, 'googleAds:search', {
    query: `
      SELECT
        shared_set.resource_name,
        shared_set.name,
        shared_set.type
      FROM shared_set
      WHERE shared_set.type = NEGATIVE_KEYWORDS
        AND shared_set.name = '${listName.replace(/'/g, "\\'")}'
      LIMIT 1
    `,
  });

  if (lookup.response.ok) {
    const rows = Array.isArray(((lookup.parsed as Record<string, unknown>))?.results) ? ((lookup.parsed as Record<string, unknown>)).results : [];
    const sharedSet = rows[0]?.sharedSet || rows[0]?.shared_set;
    const resourceName = String(sharedSet?.resourceName || sharedSet?.resource_name || '').trim();
    if (resourceName) {
      return {
        resourceName,
        name: String(sharedSet?.name || listName),
        created: false,
      };
    }
  }

  const created = await googleAdsMutate(customerId, accessToken, loginCustomerId, 'sharedSets:mutate', {
    operations: [
      {
        create: {
          name: listName,
          type: 'NEGATIVE_KEYWORDS',
        },
      },
    ],
  });
  if (!created.response.ok) {
    throw new Error(toErrorMessage(created.response.status, created.raw, created.parsed));
  }
  const resourceName = Array.isArray(((created.parsed as Record<string, unknown>))?.results)
    ? String(((created.parsed as Record<string, unknown>)).results[0]?.resourceName || '')
    : '';
  if (!resourceName) {
    throw new Error('Shared negative keyword list was created without resource name.');
  }
  return {
    resourceName,
    name: listName,
    created: true,
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as NegativeKeywordRequestBody;
    const { accessToken, customerId, loginCustomerId } = await resolveGoogleAdsContext(request, {
      customerId: body.customerId,
      loginCustomerId: body.loginCustomerId,
    });

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const scope = normalizeScope(body.scope);
    const sharedListName = normalizeSharedListName(body.sharedListName) || 'BScale Shared Negatives';
    if (!rawItems.length) {
      return NextResponse.json({ message: 'No negative keyword items provided.' }, { status: 400 });
    }

    const dedup = new Map<
      string,
      {
        term: string;
        campaignId: string;
        campaignName: string;
        adGroupId: string;
        adGroupName: string;
        matchType: 'BROAD' | 'PHRASE' | 'EXACT';
      }
    >();
    const skipped: Array<{ term: string; campaignId?: string; adGroupId?: string; reason: string }> = [];

    rawItems.slice(0, 100).forEach((item) => {
      const term = normalizeKeywordTerm(item?.term);
      const campaignId = normalizeCampaignId(item?.campaignId);
      const adGroupId = normalizeCampaignId(item?.adGroupId);
      const matchType = normalizeMatchType(item?.matchType);
      const campaignName = String(item?.campaignName || '').trim();
      const adGroupName = String(item?.adGroupName || '').trim();

      if (!term) {
        skipped.push({ term: '', campaignId, reason: 'Missing keyword term.' });
        return;
      }

      if (scope === 'campaign' && !campaignId) {
        skipped.push({ term, reason: 'Missing campaign id.' });
        return;
      }
      if (scope === 'ad_group' && !adGroupId) {
        skipped.push({ term, campaignId, reason: 'Missing ad group id.' });
        return;
      }

      const targetKey =
        scope === 'campaign' ? campaignId : scope === 'ad_group' ? adGroupId : sharedListName;
      const dedupKey = `${scope}::${targetKey}::${matchType}::${term.toLowerCase()}`;
      if (dedup.has(dedupKey)) return;
      dedup.set(dedupKey, {
        term,
        campaignId,
        campaignName,
        adGroupId,
        adGroupName,
        matchType,
      });
    });

    const applied: Array<{
      term: string;
      scope: 'campaign' | 'ad_group' | 'shared_list';
      campaignId: string;
      campaignName: string;
      adGroupId: string;
      adGroupName: string;
      matchType: string;
      resourceName?: string;
      sharedSetResourceName?: string;
      sharedSetName?: string;
    }> = [];
    const failed: Array<{
      term: string;
      scope: 'campaign' | 'ad_group' | 'shared_list';
      campaignId: string;
      campaignName: string;
      adGroupId: string;
      adGroupName: string;
      matchType: string;
      message: string;
    }> = [];

    let sharedSetInfo:
      | {
          resourceName: string;
          name: string;
          created: boolean;
        }
      | null = null;
    if (scope === 'shared_list') {
      sharedSetInfo = await lookupOrCreateSharedSet(
        customerId,
        accessToken,
        loginCustomerId,
        sharedListName
      );
    }

    for (const item of dedup.values()) {
      const mutateBody =
        scope === 'campaign'
          ? {
              operations: [
                {
                  create: {
                    campaign: `customers/${customerId}/campaigns/${item.campaignId}`,
                    negative: true,
                    keyword: {
                      text: item.term,
                      matchType: item.matchType,
                    },
                  },
                },
              ],
            }
          : scope === 'ad_group'
          ? {
              operations: [
                {
                  create: {
                    adGroup: `customers/${customerId}/adGroups/${item.adGroupId}`,
                    negative: true,
                    keyword: {
                      text: item.term,
                      matchType: item.matchType,
                    },
                  },
                },
              ],
            }
          : {
              operations: [
                {
                  create: {
                    sharedSet: sharedSetInfo?.resourceName,
                    keyword: {
                      text: item.term,
                      matchType: item.matchType,
                    },
                  },
                },
              ],
            };
      const endpoint =
        scope === 'campaign'
          ? 'campaignCriteria:mutate'
          : scope === 'ad_group'
          ? 'adGroupCriteria:mutate'
          : 'sharedCriteria:mutate';

      const result = await googleAdsMutate(
        customerId,
        accessToken,
        loginCustomerId,
        endpoint,
        mutateBody
      );
      if (!result.response.ok) {
        failed.push({
          term: item.term,
          scope,
          campaignId: item.campaignId,
          campaignName: item.campaignName,
          adGroupId: item.adGroupId,
          adGroupName: item.adGroupName,
          matchType: item.matchType,
          message: toErrorMessage(result.response.status, result.raw, result.parsed),
        });
        continue;
      }

      const resourceName = Array.isArray(((result.parsed as Record<string, unknown>))?.results)
        ? String(((result.parsed as Record<string, unknown>)).results[0]?.resourceName || '')
        : '';
      applied.push({
        term: item.term,
        scope,
        campaignId: item.campaignId,
        campaignName: item.campaignName,
        adGroupId: item.adGroupId,
        adGroupName: item.adGroupName,
        matchType: item.matchType,
        resourceName: resourceName || undefined,
        sharedSetResourceName: sharedSetInfo?.resourceName,
        sharedSetName: sharedSetInfo?.name,
      });
    }

    let sharedSetCampaignLinks: {
      attempted: number;
      applied: number;
      failed: number;
    } | null = null;
    if (scope === 'shared_list' && sharedSetInfo) {
      const uniqueCampaignIds = [
        ...new Set(
          Array.from(dedup.values())
            .map((item) => item.campaignId)
            .filter(Boolean)
        ),
      ];
      let linksApplied = 0;
      let linksFailed = 0;

      for (const campaignId of uniqueCampaignIds) {
        const linkResult = await googleAdsMutate(
          customerId,
          accessToken,
          loginCustomerId,
          'campaignSharedSets:mutate',
          {
            operations: [
              {
                create: {
                  campaign: `customers/${customerId}/campaigns/${campaignId}`,
                  sharedSet: sharedSetInfo.resourceName,
                },
              },
            ],
          }
        );
        if (!linkResult.response.ok) {
          const message = toErrorMessage(linkResult.response.status, linkResult.raw, linkResult.parsed);
          // Keep idempotent behavior: "already exists" should not be considered failure.
          if (message.toLowerCase().includes('already exists')) {
            linksApplied += 1;
          } else {
            linksFailed += 1;
          }
        } else {
          linksApplied += 1;
        }
      }
      sharedSetCampaignLinks = {
        attempted: uniqueCampaignIds.length,
        applied: linksApplied,
        failed: linksFailed,
      };
    }

    return NextResponse.json(
      {
        success: applied.length > 0,
        scope,
        summary: {
          requested: rawItems.length,
          deduplicated: dedup.size,
          applied: applied.length,
          failed: failed.length,
          skipped: skipped.length,
        },
        applied,
        failed,
        skipped,
        sharedSet:
          sharedSetInfo == null
            ? null
            : {
                resourceName: sharedSetInfo.resourceName,
                name: sharedSetInfo.name,
                created: sharedSetInfo.created,
                campaignLinks: sharedSetCampaignLinks,
              },
        customerId,
      },
      { status: applied.length > 0 ? 200 : 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to apply negative keywords in Google Ads.',
      },
      { status: httpStatusFromError(error) }
    );
  }
}
