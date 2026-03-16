import { auth, onAuthStateChanged } from '../lib/firebase';
import { API_BASE } from '../lib/utils/client-api-base';

const META_CACHE_PREFIX = 'bscale:meta-campaigns:';
const META_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;
const META_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
let metaRateLimitedUntil = 0;
let lastSuccessfulMetaCampaigns: any[] = [];
const metaInFlight = new Map<string, Promise<any[]>>();
let metaNextAllowedRequestAt = 0;

export const isMetaRateLimitMessage = (message: string) => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('too many calls') ||
    normalized.includes('rate limit') ||
    normalized.includes('rate-limiting') ||
    (normalized.includes('ad-account') && normalized.includes('wait a bit'))
  );
};

const buildMetaCacheKey = (adAccountId?: string, startDate?: string, endDate?: string) =>
  `${META_CACHE_PREFIX}${String(adAccountId || 'selected')}|${String(startDate || 'none')}|${String(endDate || 'none')}`;

const loadCachedMetaCampaigns = (cacheKey: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; items?: any[] };
    const savedAt = Number(parsed.savedAt || 0);
    if (!Array.isArray(parsed.items)) return null;
    return {
      savedAt: Number.isFinite(savedAt) ? savedAt : 0,
      items: parsed.items,
    };
  } catch {
    return null;
  }
};

const loadAnyCachedMetaCampaigns = () => {
  if (typeof window === 'undefined') return null;
  let latest: { savedAt: number; items: any[] } | null = null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(META_CACHE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { savedAt?: number; items?: any[] };
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        const savedAt = Number(parsed.savedAt || 0);
        if (!latest || savedAt > latest.savedAt) {
          latest = {
            savedAt: Number.isFinite(savedAt) ? savedAt : 0,
            items: parsed.items,
          };
        }
      }
    }
  } catch {
    // ignore
  }
  return latest;
};

const saveCachedMetaCampaigns = (cacheKey: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        savedAt: Date.now(),
        items,
      })
    );
  } catch {
    // ignore storage quota errors
  }
};

const ensureManagedApiSession = async (accessToken: string) => {
  if (accessToken !== 'server-managed') return;
  const user =
    auth.currentUser ||
    (await new Promise<typeof auth.currentUser>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        unsubscribe();
        resolve(auth.currentUser);
      }, 3000);
      const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        resolve(nextUser);
      });
    }));
  if (!user) return;
  const idToken = await user.getIdToken();
  await fetch(`${API_BASE}/api/auth/session/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
};

export async function fetchMetaAdAccounts(accessToken: string) {
  await ensureManagedApiSession(accessToken);

  if (accessToken === 'server-managed') {
    const managedResponse = await fetch(`${API_BASE}/api/connections/meta/accounts`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    const managedPayload = await managedResponse.json().catch(() => null);
    if (!managedResponse.ok || !managedPayload?.success) {
      throw new Error(managedPayload?.message || 'Failed to fetch managed Meta ad accounts');
    }

    const accounts = Array.isArray(managedPayload?.data?.accounts) ? managedPayload.data.accounts : [];
    return accounts.map((account: any) => ({
      id: account.externalAccountId,
      account_id: account.externalAccountId,
      name: account.name || account.externalAccountId,
      currency: account.currency || undefined,
      timezone_name: account.timezone || undefined,
      status: account.status,
      isSelected: Boolean(account.isSelected),
    }));
  }

  const response = await fetch('https://graph.facebook.com/v19.0/me/adaccounts', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Meta ad accounts');
  }
  
  const data = await response.json();
  return data.data;
}

export async function fetchMetaCampaigns(
  accessToken: string,
  adAccountId?: string,
  startDate?: string,
  endDate?: string
) {
  await ensureManagedApiSession(accessToken);
  const cacheKey = buildMetaCacheKey(adAccountId, startDate, endDate);
  const inFlight = metaInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const run = async () => {
    const cached = loadCachedMetaCampaigns(cacheKey);
    const now = Date.now();
    if (cached?.items?.length && now - cached.savedAt < META_CLIENT_CACHE_TTL_MS) {
      return cached.items;
    }

    if (Date.now() < metaRateLimitedUntil) {
      if (cached?.items?.length) return cached.items;
      const anyCached = loadAnyCachedMetaCampaigns();
      if (anyCached?.items?.length) return anyCached.items;
      if (lastSuccessfulMetaCampaigns.length > 0) return lastSuccessfulMetaCampaigns;
      throw new Error('Meta is temporarily rate-limited. Please wait 2-3 minutes and retry.');
    }

    if (now < metaNextAllowedRequestAt) {
      if (cached?.items?.length) return cached.items;
      const anyCached = loadAnyCachedMetaCampaigns();
      if (anyCached?.items?.length) return anyCached.items;
      if (lastSuccessfulMetaCampaigns.length > 0) return lastSuccessfulMetaCampaigns;
    }

    const loadCampaigns = async (candidateAccountId?: string) => {
      const query = new URLSearchParams();
      if (candidateAccountId) query.set('ad_account_id', candidateAccountId);
      if (startDate) query.set('start_date', startDate);
      if (endDate) query.set('end_date', endDate);

      const response = await fetch(`${API_BASE}/api/connections/meta/campaigns?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);
      return { response, payload };
    };

    let { response, payload } = await loadCampaigns(adAccountId);
    if (!response.ok && adAccountId) {
      const message = String((payload as any)?.message || '').toLowerCase();
      const hasStaleAccountError =
        message.includes('unsupported get request') ||
        message.includes('does not exist') ||
        message.includes('unknown path components') ||
        message.includes('cannot access ad account') ||
        message.includes('permission') ||
        message.includes('invalid parameter') ||
        message.includes('nonexisting field');

      // Retry once without forcing a possibly stale account id.
      if (hasStaleAccountError) {
        ({ response, payload } = await loadCampaigns(undefined));
      }
    }

    if (!response.ok) {
      const message = String((payload as any)?.message || 'Failed to fetch Meta campaigns');
      if (isMetaRateLimitMessage(message) || response.status === 429) {
        metaRateLimitedUntil = Date.now() + META_RATE_LIMIT_COOLDOWN_MS;
        metaNextAllowedRequestAt = Date.now() + META_RATE_LIMIT_COOLDOWN_MS;
        const cachedHit = loadCachedMetaCampaigns(cacheKey);
        if (cachedHit?.items?.length) {
          return cachedHit.items;
        }
        const anyCached = loadAnyCachedMetaCampaigns();
        if (anyCached?.items?.length) {
          return anyCached.items;
        }
        if (lastSuccessfulMetaCampaigns.length > 0) {
          return lastSuccessfulMetaCampaigns;
        }
      }
      throw new Error(message);
    }

    let campaigns = Array.isArray((payload as any)?.data) ? (payload as any).data : [];
    if (campaigns.length === 0 && adAccountId) {
      // Retry once without forcing account ID to avoid stale/incorrect UI-selected accounts.
      const fallbackResult = await loadCampaigns(undefined);
      if (fallbackResult.response.ok) {
        campaigns = Array.isArray((fallbackResult.payload as any)?.data)
          ? (fallbackResult.payload as any).data
          : campaigns;
      }
    }
    const mapped = campaigns.map((c: any) => {
    const insights = c.insights?.data?.[0] || {};
    const spend = parseFloat(insights.spend || 0) || 0;
    const impressions = parseFloat(insights.impressions || 0) || 0;
    const clicks = parseFloat(insights.clicks || 0) || 0;
    const reach = parseFloat(insights.reach || 0) || 0;
    const ctr =
      parseFloat(insights.ctr || 0) ||
      (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const cpc = parseFloat(insights.cpc || 0) || (clicks > 0 ? spend / clicks : 0);
    const cpm = parseFloat(insights.cpm || 0) || (impressions > 0 ? (spend / impressions) * 1000 : 0);
    const frequency = parseFloat(insights.frequency || 0) || (reach > 0 ? impressions / reach : 0);
    const actions = Array.isArray(insights.actions) ? insights.actions : [];
    const actionValues = Array.isArray(insights.action_values) ? insights.action_values : [];
    const conversionActionTypes = new Set([
      'purchase',
      'offsite_conversion.purchase',
      'omni_purchase',
      'onsite_conversion.purchase',
      'lead',
      'offsite_conversion.fb_pixel_lead',
    ]);
    const conversionValueTypes = new Set([
      'purchase',
      'offsite_conversion.purchase',
      'omni_purchase',
      'onsite_conversion.purchase',
    ]);
    const conversions = actions.reduce((sum: number, action: any) => {
      if (!action || !conversionActionTypes.has(String(action.action_type || ''))) return sum;
      const v = parseFloat(action.value || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const conversionValue = actionValues.reduce((sum: number, action: any) => {
      if (!action || !conversionValueTypes.has(String(action.action_type || ''))) return sum;
      const v = parseFloat(action.value || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const cpa = conversions > 0 ? spend / conversions : 0;
    const roasFromInsight =
      Array.isArray(insights.purchase_roas) && insights.purchase_roas[0]?.value != null
        ? parseFloat(insights.purchase_roas[0].value || 0)
        : Array.isArray(insights.roas) && insights.roas[0]?.value != null
        ? parseFloat(insights.roas[0].value || 0)
        : 0;
    const roas = roasFromInsight > 0 ? roasFromInsight : spend > 0 ? conversionValue / spend : 0;
    const channelBreakdownRows = Array.isArray(c.channelBreakdown) ? c.channelBreakdown : [];
    const channelAgg = channelBreakdownRows.reduce(
      (acc: any, row: any) => {
        const rawPlatform = String(row?.publisher_platform || '').toLowerCase();
        const platform =
          rawPlatform === 'facebook'
            ? 'facebook'
            : rawPlatform === 'instagram'
              ? 'instagram'
              : rawPlatform === 'messenger'
                ? 'messenger'
                : rawPlatform;
        if (!platform) return acc;
        const next = acc[platform] || {
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          conversions: 0,
        };
        const rowSpend = parseFloat(row?.spend || 0) || 0;
        const rowImpressions = parseFloat(row?.impressions || 0) || 0;
        const rowClicks = parseFloat(row?.clicks || 0) || 0;
        const rowReach = parseFloat(row?.reach || 0) || 0;
        const rowActions = Array.isArray(row?.actions) ? row.actions : [];
        const rowConversions = rowActions.reduce((sum: number, action: any) => {
          const actionType = String(action?.action_type || '').toLowerCase();
          if (
            actionType === 'purchase' ||
            actionType.includes('purchase') ||
            actionType.includes('lead') ||
            actionType.includes('messaging')
          ) {
            const v = parseFloat(action?.value || 0);
            return sum + (Number.isFinite(v) ? v : 0);
          }
          return sum;
        }, 0);
        acc[platform] = {
          spend: next.spend + rowSpend,
          impressions: next.impressions + rowImpressions,
          clicks: next.clicks + rowClicks,
          reach: next.reach + rowReach,
          conversions: next.conversions + rowConversions,
        };
        return acc;
      },
      {} as Record<string, { spend: number; impressions: number; clicks: number; reach: number; conversions: number }>
    );

    const promotedObject = c.promoted_object || {};
    const hasWhatsappDestination =
      Boolean(promotedObject?.whatsapp_phone_number) ||
      String(c?.destination_type || '').toLowerCase().includes('whatsapp');
    const whatsappConversations =
      (channelAgg.messenger?.conversions || 0) +
      actions.reduce((sum: number, action: any) => {
        const actionType = String(action?.action_type || '').toLowerCase();
        if (!actionType.includes('messaging') && !actionType.includes('whatsapp')) return sum;
        const v = parseFloat(action?.value || 0);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0);

    return {
      id: c.id,
      name: c.name,
      platform: 'Meta',
      status:
        c.effective_status ||
        c.configured_status ||
        c.status ||
        (c.status === 'ACTIVE' ? 'Active' : 'Paused'),
      objective: c.objective || '',
      buyingType: c.buying_type || '',
      accountId: c.account_id || '',
      campaignId: c.id || '',
      startTime: c.start_time || '',
      stopTime: c.stop_time || '',
      createdTime: c.created_time || '',
      updatedTime: c.updated_time || '',
      dailyBudget: parseFloat(c.daily_budget || 0) || 0,
      lifetimeBudget: parseFloat(c.lifetime_budget || 0) || 0,
      reach,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      frequency,
      spend,
      roas: Number.isFinite(roas) ? roas.toFixed(2) : '0.00',
      cpa,
      conversions,
      conversionValue,
      metaChannels: {
        facebook: channelAgg.facebook || null,
        instagram: channelAgg.instagram || null,
        whatsapp: hasWhatsappDestination
          ? {
              enabled: true,
              spend: channelAgg.messenger?.spend || 0,
              conversations: whatsappConversations,
            }
          : null,
      },
      channelBreakdown: channelAgg,
    };
    });

    // Surface server-side diagnostics to the browser console for easier debugging.
    const responseMeta = (payload as any)?.meta;
    if (responseMeta?.insightsFetchError) {
      console.error('[Meta] Server failed to fetch insights:', responseMeta.insightsFetchError);
    }
    if (responseMeta?.allMetricsZero && mapped.length > 0) {
      console.warn(
        `[Meta] All ${mapped.length} campaign(s) returned zero metrics for date range ${responseMeta?.dateRange?.startDate ?? '?'} → ${responseMeta?.dateRange?.endDate ?? '?'}. ` +
        'Possible causes: campaigns have no delivery, billing is paused, or ads are disapproved.'
      );
    }

    saveCachedMetaCampaigns(cacheKey, mapped);
    if (mapped.length > 0) {
      lastSuccessfulMetaCampaigns = mapped;
      metaNextAllowedRequestAt = Date.now() + 90_000;
    }
    return mapped;
  };

  const requestPromise = run().finally(() => {
    metaInFlight.delete(cacheKey);
  });
  metaInFlight.set(cacheKey, requestPromise);
  return requestPromise;
}

export type MetaAdset = {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  dailyBudget: number;
  lifetimeBudget: number;
  optimizationGoal: string;
  bidStrategy: string;
  billingEvent: string;
  startTime: string;
  endTime: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  uniqueClicks: number;
  uniqueCtr: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  cpa: number;
};

export async function fetchMetaAdsets(
  accessToken: string,
  adAccountId?: string,
  campaignIds?: string[],
  startDate?: string,
  endDate?: string
): Promise<MetaAdset[]> {
  await ensureManagedApiSession(accessToken);
  const query = new URLSearchParams();
  if (adAccountId) query.set('ad_account_id', adAccountId);
  if (campaignIds?.length) query.set('campaign_ids', campaignIds.join(','));
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);

  const response = await fetch(`${API_BASE}/api/connections/meta/adsets?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any).message || 'Failed to fetch Meta adsets');
  }

  const payload = await response.json();
  return Array.isArray((payload as any).data) ? (payload as any).data : [];
}
