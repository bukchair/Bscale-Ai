import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_CACHE_TTL_MS = 5 * 60 * 1000;
type MetaCampaignsPayload = {
  data: Array<Record<string, unknown>>;
  meta: {
    adAccountId: string;
    insightsFallbackUsed: boolean;
    dateRange: { startDate: string | null; endDate: string | null };
    cached?: boolean;
    stale?: boolean;
    rateLimited?: boolean;
  };
};
const metaCampaignsCache = new Map<
  string,
  {
    savedAt: number;
    accountId: string;
    payload: MetaCampaignsPayload;
  }
>();
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const normalizeDateParam = (value: string | null) => {
  const trimmed = (value || '').trim();
  return DATE_PARAM_REGEX.test(trimmed) ? trimmed : '';
};

const getClampedDateRange = (url: URL) => {
  const todayIso = new Date().toISOString().split('T')[0];
  const rawStart = normalizeDateParam(url.searchParams.get('start_date'));
  const rawEnd = normalizeDateParam(url.searchParams.get('end_date'));
  if (!rawStart || !rawEnd) {
    return { startDate: '', endDate: '' };
  }
  const clampedStart = rawStart > todayIso ? todayIso : rawStart;
  const clampedEnd = rawEnd > todayIso ? todayIso : rawEnd;
  if (clampedStart <= clampedEnd) {
    return { startDate: clampedStart, endDate: clampedEnd };
  }
  return { startDate: clampedEnd, endDate: clampedStart };
};

const normalizeMetaAccountId = (value: string) => {
  const trimmed = String(value || '').replace(/^act_/i, '').trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  return digitsOnly || trimmed;
};

const toAccountResource = (value: string) => {
  const normalized = normalizeMetaAccountId(value);
  if (!normalized) return '';
  return `act_${normalized}`;
};

const pickSelectedAccountId = (
  connection: Awaited<ReturnType<typeof connectionService.getByUserPlatform>>
) =>
  connection?.connectedAccounts.find(
    (account) => account.isSelected && account.status !== 'ARCHIVED'
  )?.externalAccountId ||
  connection?.connectedAccounts.find((account) => account.status !== 'ARCHIVED')?.externalAccountId ||
  '';

const isKnownManagedAccount = (
  connection: Awaited<ReturnType<typeof connectionService.getByUserPlatform>>,
  candidateAccountId: string
) => {
  const normalizedCandidate = normalizeMetaAccountId(candidateAccountId);
  if (!normalizedCandidate) return false;
  return (connection?.connectedAccounts || []).some(
    (account) =>
      account.status !== 'ARCHIVED' &&
      normalizeMetaAccountId(account.externalAccountId) === normalizedCandidate
  );
};

const isRecoverableAccountError = (status: number, message: string) => {
  if (status !== 400 && status !== 403) return false;
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('unsupported get request') ||
    normalized.includes('does not exist') ||
    normalized.includes('unknown path components') ||
    normalized.includes('cannot access ad account') ||
    normalized.includes('permission') ||
    normalized.includes('no permission') ||
    normalized.includes('invalid parameter')
  );
};

const extractErrorMessage = (status: number, parsed: unknown) => {
  if (!parsed || typeof parsed !== 'object') return `Meta API request failed (${status}).`;
  const objectPayload = parsed as { error?: { message?: string }; message?: string };
  return objectPayload.error?.message || objectPayload.message || `Meta API request failed (${status}).`;
};

const isMetaRateLimitError = (message: string) => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('too many calls') ||
    normalized.includes('rate limit') ||
    normalized.includes('rate-limiting') ||
    normalized.includes('ad-account') && normalized.includes('wait a bit')
  );
};

const buildMetaCacheKey = (accountId: string, startDate: string, endDate: string) =>
  `${normalizeMetaAccountId(accountId)}|${startDate || 'none'}|${endDate || 'none'}`;

const getFreshMetaCache = (key: string) => {
  const hit = metaCampaignsCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.savedAt > META_CACHE_TTL_MS) return null;
  return hit;
};

const getLatestMetaCacheByAccount = (accountId: string) => {
  const normalizedAccountId = normalizeMetaAccountId(accountId);
  let latest:
    | {
        savedAt: number;
        accountId: string;
        payload: MetaCampaignsPayload;
      }
    | null = null;
  for (const value of metaCampaignsCache.values()) {
    if (normalizeMetaAccountId(value.accountId) !== normalizedAccountId) continue;
    if (!latest || value.savedAt > latest.savedAt) {
      latest = value;
    }
  }
  return latest;
};

const getCampaignRows = (parsed: unknown): Array<Record<string, unknown>> => {
  if (!parsed || typeof parsed !== 'object') return [];
  const rows = (parsed as { data?: Array<Record<string, unknown>> }).data;
  return Array.isArray(rows) ? rows : [];
};

const getInsightRows = (parsed: unknown): Array<Record<string, unknown>> => {
  if (!parsed || typeof parsed !== 'object') return [];
  const rows = (parsed as { data?: Array<Record<string, unknown>> }).data;
  return Array.isArray(rows) ? rows : [];
};

const hasCampaignUsableEmbeddedInsights = (campaign: Record<string, unknown>) => {
  const insights = (campaign as { insights?: { data?: Array<Record<string, unknown>> } }).insights;
  const row = Array.isArray(insights?.data) && insights.data.length > 0 ? insights.data[0] : null;
  if (!row || typeof row !== 'object') return false;
  // A row that only contains spend/actions is not enough for campaign table metrics.
  const metricKeys = ['impressions', 'clicks', 'reach', 'ctr', 'cpc', 'cpm', 'frequency'];
  return metricKeys.some((key) => Object.prototype.hasOwnProperty.call(row, key));
};

const hasUsableEmbeddedInsights = (campaigns: Array<Record<string, unknown>>) =>
  campaigns.length > 0 && campaigns.every((campaign) => hasCampaignUsableEmbeddedInsights(campaign));

const getBearerToken = (request: Request): string => {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedAccountId = (url.searchParams.get('ad_account_id') || '').trim();
    const { startDate, endDate } = getClampedDateRange(url);

    let accessToken = getBearerToken(request);
    let resolvedAccountId = requestedAccountId;
    let managedConnection:
      | Awaited<ReturnType<typeof connectionService.getByUserPlatform>>
      | null = null;
    let managedUserId = '';

    // Use managed server token when client token is missing or intentionally masked.
    if (!accessToken || accessToken === 'server-managed') {
      const user = await requireAuthenticatedUser();
      managedUserId = user.id;
      managedConnection = await connectionService.getByUserPlatform(user.id, 'META');
      if (!managedConnection) {
        return NextResponse.json({ message: 'Meta connection is not available for this user.' }, { status: 400 });
      }
      if (resolvedAccountId && !isKnownManagedAccount(managedConnection, resolvedAccountId)) {
        // Ignore stale/foreign account IDs coming from client state.
        resolvedAccountId = '';
      }
      if (!resolvedAccountId) {
        resolvedAccountId = pickSelectedAccountId(managedConnection);
      }
      accessToken = await new MetaProvider().getAccessTokenForConnection(managedConnection.id);
    }

    // Fallback: if connected account wasn't selected/saved, auto-discover and select first.
    if (!resolvedAccountId && managedConnection && managedUserId) {
      try {
        const discovered = await new MetaProvider().discoverAccounts(managedConnection.id);
        if (discovered.length > 0) {
          await connectionService.saveDiscoveredAccounts(managedUserId, managedConnection.id, 'META', discovered);
          await connectionService.setSelectedAccounts(managedUserId, managedConnection.id, [
            discovered[0].externalAccountId,
          ]);
          resolvedAccountId = discovered[0].externalAccountId;
        }
      } catch {
        // Keep fallback flow below for token-only mode.
      }
    }

    // Token-only mode fallback: discover first ad account directly from Meta API.
    if (!resolvedAccountId && accessToken && accessToken !== 'server-managed') {
      try {
        const discoverUrl = new URL(`${META_GRAPH_BASE}/me/adaccounts`);
        discoverUrl.searchParams.set('fields', 'account_id');
        discoverUrl.searchParams.set('limit', '1');
        discoverUrl.searchParams.set('access_token', accessToken);
        const discoverResponse = await fetch(discoverUrl.toString());
        const discoverPayload = (await discoverResponse.json().catch(() => null)) as
          | { data?: Array<{ account_id?: string }> }
          | null;
        resolvedAccountId = String(discoverPayload?.data?.[0]?.account_id || '').trim();
      } catch {
        // If discovery fails, we return explicit error below.
      }
    }

    if (!resolvedAccountId) {
      return NextResponse.json(
        { message: 'Meta account not selected. Reconnect Meta and select an ad account.' },
        { status: 400 }
      );
    }

    const cacheKey = buildMetaCacheKey(resolvedAccountId, startDate, endDate);
    const cached = getFreshMetaCache(cacheKey);
    if (cached) {
      return NextResponse.json(
        {
          ...cached.payload,
          meta: {
            ...cached.payload.meta,
            cached: true,
          },
        },
        { status: 200 }
      );
    }

    const loadCampaigns = async (
      accountId: string,
      options?: {
        includeDateRange?: boolean;
        includeInsights?: boolean;
        includeEffectiveStatus?: boolean;
      }
    ) => {
      const includeDateRange = options?.includeDateRange !== false;
      const includeInsights = options?.includeInsights !== false;
      const includeEffectiveStatus = options?.includeEffectiveStatus !== false;
      const resource = toAccountResource(accountId);
      const graphUrl = new URL(`${META_GRAPH_BASE}/${resource}/campaigns`);
      const baseFields =
        'id,name,status,effective_status,configured_status,objective,buying_type,account_id,start_time,stop_time,created_time,updated_time,daily_budget,lifetime_budget,promoted_object,destination_type';
      const insightsFields =
        'insights{spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,inline_link_click_ctr,purchase_roas,roas,actions,action_values}';
      graphUrl.searchParams.set('fields', includeInsights ? `${baseFields},${insightsFields}` : baseFields);
      if (includeEffectiveStatus) {
        graphUrl.searchParams.set(
          'effective_status',
          JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'WITH_ISSUES', 'DELETED'])
        );
      }
      graphUrl.searchParams.set('limit', '200');
      if (includeDateRange && startDate && endDate) {
        graphUrl.searchParams.set(
          'time_range',
          JSON.stringify({
            since: startDate,
            until: endDate,
          })
        );
      }
      graphUrl.searchParams.set('access_token', accessToken);

      const response = await fetch(graphUrl.toString());
      const raw = await response.text();
      let parsed: unknown = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = { message: raw || 'Meta API returned non-JSON response.' };
      }
      return { response, parsed };
    };

    const loadCampaignInsights = async (accountId: string) => {
      const resource = toAccountResource(accountId);
      const fieldsVariants = [
        'campaign_id,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values,purchase_roas,roas',
        'campaign_id,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,action_values',
        'campaign_id,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency',
        'campaign_id,spend,impressions,clicks',
      ];

      let lastResponse: Response | null = null;
      let lastParsed: unknown = {};

      for (const fields of fieldsVariants) {
        const graphUrl = new URL(`${META_GRAPH_BASE}/${resource}/insights`);
        graphUrl.searchParams.set('level', 'campaign');
        graphUrl.searchParams.set('limit', '500');
        graphUrl.searchParams.set('fields', fields);
        if (startDate && endDate) {
          graphUrl.searchParams.set(
            'time_range',
            JSON.stringify({
              since: startDate,
              until: endDate,
            })
          );
        }
        graphUrl.searchParams.set('access_token', accessToken);

        const response = await fetch(graphUrl.toString());
        const raw = await response.text();
        let parsed: unknown = {};
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { message: raw || 'Meta insights returned non-JSON response.' };
        }

        lastResponse = response;
        lastParsed = parsed;
        if (response.ok) {
          return { response, parsed };
        }

        const message = extractErrorMessage(response.status, parsed).toLowerCase();
        if (!message.includes('invalid parameter')) {
          break;
        }
      }

      return {
        response: lastResponse as Response,
        parsed: lastParsed,
      };
    };

    const loadPublisherPlatformBreakdown = async (accountId: string) => {
      const resource = toAccountResource(accountId);
      const fieldsVariants = [
        'campaign_id,publisher_platform,spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values',
        'campaign_id,publisher_platform,spend,impressions,reach,clicks,ctr,cpc,cpm',
        'campaign_id,publisher_platform,spend,impressions,clicks',
      ];

      let lastResponse: Response | null = null;
      let lastParsed: unknown = {};

      for (const fields of fieldsVariants) {
        const graphUrl = new URL(`${META_GRAPH_BASE}/${resource}/insights`);
        graphUrl.searchParams.set('level', 'campaign');
        graphUrl.searchParams.set('limit', '1000');
        graphUrl.searchParams.set('fields', fields);
        graphUrl.searchParams.set('breakdowns', 'publisher_platform');
        if (startDate && endDate) {
          graphUrl.searchParams.set(
            'time_range',
            JSON.stringify({
              since: startDate,
              until: endDate,
            })
          );
        }
        graphUrl.searchParams.set('access_token', accessToken);

        const response = await fetch(graphUrl.toString());
        const raw = await response.text();
        let parsed: unknown = {};
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { message: raw || 'Meta publisher breakdown returned non-JSON response.' };
        }

        lastResponse = response;
        lastParsed = parsed;
        if (response.ok) {
          return { response, parsed };
        }

        const message = extractErrorMessage(response.status, parsed).toLowerCase();
        if (!message.includes('invalid parameter')) {
          break;
        }
      }

      return {
        response: lastResponse as Response,
        parsed: lastParsed,
      };
    };

    const attemptCampaignLoad = async (accountId: string) => {
      // Strategy order: full query -> drop effective_status -> minimal.
      const attempts: Array<{
        includeDateRange?: boolean;
        includeInsights?: boolean;
        includeEffectiveStatus?: boolean;
      }> = [
        { includeDateRange: true, includeInsights: true, includeEffectiveStatus: true },
        { includeDateRange: true, includeInsights: false, includeEffectiveStatus: false },
        { includeDateRange: false, includeInsights: false, includeEffectiveStatus: false },
      ];
      let lastResult: Awaited<ReturnType<typeof loadCampaigns>> | null = null;
      for (const attempt of attempts) {
        lastResult = await loadCampaigns(accountId, attempt);
        if (lastResult.response.ok) {
          const rows = getCampaignRows(lastResult.parsed);
          const isRestrictiveAttempt =
            attempt.includeEffectiveStatus !== false ||
            attempt.includeDateRange !== false ||
            attempt.includeInsights !== false;
          if (rows.length === 0 && isRestrictiveAttempt) {
            // Retry with less restrictive query before deciding there are no campaigns.
            continue;
          }
          return lastResult;
        }
        const message = extractErrorMessage(lastResult.response.status, lastResult.parsed).toLowerCase();
        if (!message.includes('invalid parameter')) {
          return lastResult;
        }
      }
      return lastResult as Awaited<ReturnType<typeof loadCampaigns>>;
    };

    let result = await attemptCampaignLoad(resolvedAccountId);
    let response = result.response;
    let parsed = result.parsed;

    // If the account id sent by client is stale/invalid, auto-fallback to a valid managed account.
    if (managedConnection && managedUserId && !response.ok) {
      const firstErrorMessage = extractErrorMessage(response.status, parsed);
      if (isRecoverableAccountError(response.status, firstErrorMessage)) {
        let fallbackAccountId = pickSelectedAccountId(managedConnection);
        if (
          normalizeMetaAccountId(fallbackAccountId) === normalizeMetaAccountId(resolvedAccountId)
        ) {
          fallbackAccountId =
            managedConnection.connectedAccounts.find(
              (account) =>
                account.status !== 'ARCHIVED' &&
                normalizeMetaAccountId(account.externalAccountId) !==
                  normalizeMetaAccountId(resolvedAccountId)
            )?.externalAccountId || '';
        }

        if (!fallbackAccountId) {
          try {
            const discovered = await new MetaProvider().discoverAccounts(managedConnection.id);
            if (discovered.length > 0) {
              await connectionService.saveDiscoveredAccounts(
                managedUserId,
                managedConnection.id,
                'META',
                discovered
              );
              await connectionService.setSelectedAccounts(managedUserId, managedConnection.id, [
                discovered[0].externalAccountId,
              ]);
              fallbackAccountId = discovered[0].externalAccountId;
            }
          } catch {
            // Keep original response if fallback discovery fails.
          }
        }

        if (
          fallbackAccountId &&
          normalizeMetaAccountId(fallbackAccountId) !== normalizeMetaAccountId(resolvedAccountId)
        ) {
          resolvedAccountId = fallbackAccountId;
          result = await attemptCampaignLoad(resolvedAccountId);
          response = result.response;
          parsed = result.parsed;
        }
      }
    }

    if (!response.ok) {
      const message = extractErrorMessage(response.status, parsed);
      if (isMetaRateLimitError(message)) {
        const staleCache = getLatestMetaCacheByAccount(resolvedAccountId);
        if (staleCache) {
          return NextResponse.json(
            {
              ...staleCache.payload,
              meta: {
                ...staleCache.payload.meta,
                cached: true,
                stale: true,
                rateLimited: true,
              },
            },
            { status: 200 }
          );
        }
      }
      const status = isMetaRateLimitError(message) ? 429 : response.status;
      return NextResponse.json({ message }, { status });
    }

    const campaigns = getCampaignRows(parsed);
    let enrichedCampaigns = campaigns;
    let insightsFallbackUsed = false;

    // If campaign payload has no embedded insights (or partial), enrich via account insights endpoint.
    if (campaigns.length > 0 && !hasUsableEmbeddedInsights(campaigns)) {
      try {
        const insightsResult = await loadCampaignInsights(resolvedAccountId);
        if (insightsResult.response.ok) {
          const insightRows = getInsightRows(insightsResult.parsed);
          const byCampaignId = new Map<string, Record<string, unknown>>();
          for (const row of insightRows) {
            const campaignId = String(row.campaign_id || '').trim();
            if (!campaignId) continue;
            byCampaignId.set(campaignId, row);
          }

          enrichedCampaigns = campaigns.map((campaign) => {
            const campaignId = String(campaign.id || '').trim();
            const insightRow = byCampaignId.get(campaignId);
            if (!insightRow) return campaign;
            return {
              ...campaign,
              insights: { data: [insightRow] },
            };
          });
          insightsFallbackUsed = true;
        } else {
          const insightsError = extractErrorMessage(insightsResult.response.status, insightsResult.parsed);
          if (isMetaRateLimitError(insightsError)) {
            // Keep campaign rows without insights when account is temporarily rate-limited.
            insightsFallbackUsed = false;
          }
        }
      } catch {
        // Keep base campaigns list if enrichment fails.
      }
    }

    if (enrichedCampaigns.length > 0) {
      try {
        const breakdownResult = await loadPublisherPlatformBreakdown(resolvedAccountId);
        if (breakdownResult.response.ok) {
          const rows = getInsightRows(breakdownResult.parsed);
          const byCampaignId = new Map<string, Array<Record<string, unknown>>>();
          for (const row of rows) {
            const campaignId = String(row.campaign_id || '').trim();
            if (!campaignId) continue;
            const current = byCampaignId.get(campaignId) || [];
            current.push(row);
            byCampaignId.set(campaignId, current);
          }

          enrichedCampaigns = enrichedCampaigns.map((campaign) => {
            const campaignId = String(campaign.id || '').trim();
            const channelBreakdown = byCampaignId.get(campaignId) || [];
            if (channelBreakdown.length === 0) return campaign;
            return {
              ...campaign,
              channelBreakdown,
            };
          });
        }
      } catch {
        // Keep base campaign list when publisher-platform breakdown fails.
      }
    }

    const payload: MetaCampaignsPayload = {
      data: enrichedCampaigns,
      meta: {
        adAccountId: toAccountResource(resolvedAccountId),
        insightsFallbackUsed,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    };
    metaCampaignsCache.set(cacheKey, {
      savedAt: Date.now(),
      accountId: resolvedAccountId,
      payload,
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch Meta campaigns.' },
      { status: 500 }
    );
  }
}
