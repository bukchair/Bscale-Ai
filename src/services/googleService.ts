import { auth } from '../lib/firebase';

const viteEnv =
  typeof import.meta !== 'undefined'
    ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ?? undefined)
    : undefined;
const configuredApiBase = (typeof viteEnv?.VITE_APP_URL === 'string' && viteEnv.VITE_APP_URL.trim()) || '';
const API_BASE = (() => {
  if (!configuredApiBase || typeof window === 'undefined') return '';
  try {
    const configuredOrigin = new URL(configuredApiBase, window.location.origin).origin;
    return configuredOrigin === window.location.origin ? configuredOrigin : '';
  } catch {
    return '';
  }
})();

const ensureManagedApiSession = async (accessToken: string) => {
  if (accessToken !== 'server-managed') return;
  const user = auth.currentUser;
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
  return (data.results || []).map((r: any) => {
    const c = r.campaign;
    const m = r.metrics;
    const spend = parseFloat(m.costMicros || 0) / 1000000;
    const conversions = parseFloat(m.conversions || 0);
    const conversionValue = parseFloat(m.conversionsValue || 0);
    const cpa = conversions > 0 ? spend / conversions : 0;
    const roas = spend > 0 ? conversionValue / spend : 0;

    return {
      id: c.id,
      name: c.name,
      platform: 'Google',
      status: c.status === 'ENABLED' ? 'Active' : 'Paused',
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

      const clicks = Number(row?.metrics?.clicks || 0);
      const impressions = Number(row?.metrics?.impressions || 0);
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
        impressions,
        clicks,
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

export async function sendGmailNotification(accessToken: string, to: string, subject: string, body: string) {
  await ensureManagedApiSession(accessToken);
  const response = await fetch(`${API_BASE}/api/google/gmail/send`, {
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

export async function fetchGA4Report(
  accessToken: string,
  propertyId?: string,
  startDate?: string,
  endDate?: string
) {
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

  return response.json();
}

export async function fetchGSCData(accessToken: string, siteUrl?: string, startDate?: string, endDate?: string) {
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

  return response.json();
}
