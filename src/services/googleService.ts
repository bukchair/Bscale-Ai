import { auth, onAuthStateChanged } from '../lib/firebase';
import { API_BASE } from '../lib/utils/client-api-base';

const ensureManagedApiSession = async (accessToken: string) => {
  if (accessToken !== 'server-managed') return;
  const user =
    auth.currentUser ||
    (await new Promise<import('firebase/auth').User | null>((resolve) => {
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

export async function fetchGoogleAdAccounts(accessToken: string) {
  await ensureManagedApiSession(accessToken);
  const response = await fetch(`${API_BASE}/api/google/ads/accounts`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.message || body.error?.message || 'Failed to fetch Google ad accounts';
    throw new Error(msg);
  }

  const data = await response.json();
  return data.resourceNames || [];
}

export async function fetchGoogleCampaigns(
  accessToken: string,
  customerId?: string,
  loginCustomerId?: string,
  startDate?: string,
  endDate?: string
) {
  await ensureManagedApiSession(accessToken);
  const query = new URLSearchParams();
  if (customerId) query.set('customer_id', customerId);
  if (loginCustomerId) query.set('login_customer_id', loginCustomerId);
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);

  const response = await fetch(`${API_BASE}/api/google/ads/campaigns?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Google Ads campaigns');
  }
  
  const data = await response.json();
  
  // Google Ads API returns results in a 'results' array
  type RawGoogleAdsRow = { campaign: Record<string, string | undefined>; campaignBudget?: Record<string, string | undefined>; metrics: Record<string, string | undefined> };
  return ((data.results as RawGoogleAdsRow[]) || []).map((r) => {
    const c = r.campaign;
    const budget = r.campaignBudget || {};
    const m = r.metrics;
    const spend = parseFloat(m.costMicros ?? "0") / 1000000;
    const impressions = parseFloat(m.impressions ?? "0") || 0;
    const clicks = parseFloat(m.clicks ?? "0") || 0;
    const ctr = parseFloat(m.ctr ?? "0") || (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const avgCpc = parseFloat(m.averageCpc ?? "0") / 1000000 || (clicks > 0 ? spend / clicks : 0);
    const avgCpm = parseFloat(m.averageCpm ?? "0") / 1000000 || (impressions > 0 ? (spend / impressions) * 1000 : 0);
    const conversions = parseFloat(m.conversions ?? "0");
    const conversionValue = parseFloat(m.conversionsValue ?? "0");
    const cpa = conversions > 0 ? spend / conversions : 0;
    const costPerConversion =
      parseFloat(m.costPerConversion ?? "0") / 1000000 || (conversions > 0 ? spend / conversions : 0);
    const roas = spend > 0 ? conversionValue / spend : 0;
    const budgetMicros = parseFloat(budget.amountMicros ?? "0") || 0;

    return {
      id: c.id,
      name: c.name,
      platform: 'Google',
      status: c.status === 'ENABLED' ? 'Active' : 'Paused',
      campaignId: c.id || '',
      advertisingChannelType: c.advertisingChannelType || '',
      advertisingChannelSubType: c.advertisingChannelSubType || '',
      biddingStrategyType: c.biddingStrategyType || '',
      servingStatus: c.servingStatus || '',
      startDate: c.startDate || '',
      endDate: c.endDate || '',
      budget: budgetMicros / 1000000,
      budgetPeriod: budget.period || '',
      impressions,
      clicks,
      ctr,
      cpc: avgCpc,
      cpm: avgCpm,
      costPerConversion,
      searchImpressionShare: parseFloat(m.searchImpressionShare ?? "0") || 0,
      searchTopImpressionShare: parseFloat(m.searchTopImpressionShare ?? "0") || 0,
      absoluteTopImpressionPercentage: parseFloat(m.absoluteTopImpressionPercentage ?? "0") || 0,
      spend,
      roas: Number.isFinite(roas) ? roas.toFixed(2) : '0.00',
      cpa,
      conversions,
      conversionValue,
    };
  });
}

export async function fetchGoogleSearchTerms(
  accessToken: string,
  customerId?: string,
  loginCustomerId?: string,
  startDate?: string,
  endDate?: string
) {
  await ensureManagedApiSession(accessToken);
  const query = new URLSearchParams();
  if (customerId) query.set('customer_id', customerId);
  if (loginCustomerId) query.set('login_customer_id', loginCustomerId);
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);

  const response = await fetch(`${API_BASE}/api/google/ads/search-terms?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch Google Ads search terms');
  }

  const data = await response.json();
  const rows = Array.isArray(data.results) ? data.results : [];

  return rows
    .map((row: any) => {
      const term = String(row?.searchTermView?.searchTerm || '').trim();
      if (!term) return null;

      const campaignId = String(row?.campaign?.id || '').trim();
      const campaignName = String(row?.campaign?.name || '').trim();
      const adGroupId = String(row?.adGroup?.id || row?.ad_group?.id || '').trim();
      const adGroupName = String(row?.adGroup?.name || row?.ad_group?.name || '').trim();
      const clicks = Number(row?.metrics?.clicks || 0);
      const impressions = Number(row?.metrics?.impressions || 0);
      const ctr =
        Number(row?.metrics?.ctr || 0) ||
        (impressions > 0 ? clicks / impressions : 0);
      const cost = Number(row?.metrics?.costMicros || 0) / 1_000_000;
      const conversions = Number(row?.metrics?.conversions || 0);
      const conversionValue = Number(row?.metrics?.conversionsValue || 0);
      const roas = cost > 0 ? conversionValue / cost : 0;

      const status =
        conversions <= 0 && cost >= 25
          ? 'negative_candidate'
          : roas >= 2.5
          ? 'optimal'
          : roas > 0
          ? 'review'
          : 'review';

      return {
        term,
        campaignId,
        campaignName,
        adGroupId,
        adGroupName,
        impressions,
        clicks,
        ctr,
        cost,
        conversions,
        conversionValue,
        roas,
        source: 'Google Ads',
        status,
      };
    })
    .filter(Boolean);
}

export type GoogleNegativeKeywordItem = {
  term: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  matchType?: 'BROAD' | 'PHRASE' | 'EXACT';
};

export type GoogleNegativeKeywordScope = 'campaign' | 'ad_group' | 'shared_list';

export async function applyGoogleNegativeKeywords(
  accessToken: string,
  items: GoogleNegativeKeywordItem[],
  customerId?: string,
  loginCustomerId?: string,
  options?: {
    scope?: GoogleNegativeKeywordScope;
    sharedListName?: string;
  }
) {
  await ensureManagedApiSession(accessToken);
  const response = await fetch(`${API_BASE}/api/google/ads/search-terms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId,
      loginCustomerId,
      scope: options?.scope,
      sharedListName: options?.sharedListName,
      items,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to apply negative keywords to Google Ads');
  }
  return payload;
}

export async function sendGmailNotification(accessToken: string, to: string, subject: string, body: string) {
  await ensureManagedApiSession(accessToken);
  const response = await fetch(`${API_BASE}/api/connections/google/gmail-send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to, subject, body })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send Gmail notification');
  }

  return response.json();
}

type GA4MetricValue = { value?: string };
type GA4Row = { metricValues?: GA4MetricValue[]; metrics?: GA4MetricValue[]; dimensionValues?: { value?: string }[] };
export type GA4ReportData = {
  rows?: GA4Row[];
  metricHeaders?: { name: string }[];
  totals?: GA4Row[];
  realtime?: { activeUsers?: number; usersLast24h?: number };
  topPages?: { path?: string; title?: string; views?: number }[];
};

export async function fetchGA4Report(
  accessToken: string,
  propertyId?: string,
  startDate?: string,
  endDate?: string
): Promise<GA4ReportData> {
  await ensureManagedApiSession(accessToken);
  const query = new URLSearchParams();
  if (propertyId) query.set('property_id', propertyId);
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);
  const response = await fetch(`${API_BASE}/api/google/analytics/report?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch GA4 report');
  }

  return response.json() as Promise<GA4ReportData>;
}

export async function fetchGA4Realtime(accessToken: string, propertyId?: string) {
  await ensureManagedApiSession(accessToken);
  const query = new URLSearchParams();
  if (propertyId) query.set('property_id', propertyId);
  const response = await fetch(`${API_BASE}/api/google/analytics/realtime?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch GA4 realtime data');
  }

  return response.json() as Promise<{ topPages: Array<{ title: string; path: string; views: number }>; users24h: number }>;
}

type GSCRow = { clicks: number; impressions: number; position: number; keys?: string[] };
export async function fetchGSCData(accessToken: string, siteUrl?: string, startDate?: string, endDate?: string): Promise<{ rows: GSCRow[] }> {
  await ensureManagedApiSession(accessToken);
  const query = new URLSearchParams();
  if (siteUrl) query.set('site_url', siteUrl);
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);
  const response = await fetch(`${API_BASE}/api/google/search-console/query?${query.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch GSC data');
  }

  return response.json() as Promise<{ rows: GSCRow[] }>;
}
