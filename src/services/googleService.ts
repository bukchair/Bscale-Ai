import { auth, onAuthStateChanged } from '../lib/firebase';

type GoogleServiceSlug = 'google-ads' | 'ga4' | 'search-console' | 'gmail';

const getActiveUid = async (): Promise<string> => {
  const existing = auth.currentUser?.uid;
  if (existing) return existing;

  return new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve('');
      }
    }, 3000);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user?.uid || '');
    });
  });
};

const getManagedGoogleAccessToken = async (
  serviceSlug: GoogleServiceSlug,
  providedToken?: string
): Promise<{ accessToken: string; uid: string }> => {
  const normalized = String(providedToken || '').trim();
  const uid = await getActiveUid();

  if (normalized && normalized !== 'server-managed') {
    return { accessToken: normalized, uid };
  }

  if (!uid) {
    throw new Error('Missing authenticated user context for managed Google service token.');
  }

  const response = await fetch(
    `/api/integrations/${serviceSlug}/access-token?user_id=${encodeURIComponent(uid)}`
  );
  const payload = (await response.json().catch(() => null)) as
    | { accessToken?: string; message?: string }
    | null;
  if (!response.ok || !payload?.accessToken) {
    throw new Error(payload?.message || `Failed to resolve ${serviceSlug} access token.`);
  }
  return { accessToken: payload.accessToken, uid };
};

export async function fetchGoogleAdAccounts(accessToken: string) {
  const uid = await getActiveUid();
  const query = uid ? `?user_id=${encodeURIComponent(uid)}` : '';
  const response = await fetch(`/api/integrations/google/discover${query}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Google ad accounts');
  }
  
  const data = await response.json();
  return data.discovered?.googleAdsId ? [data.discovered.googleAdsId] : [];
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number; token_type?: string; scope?: string }> {
  const response = await fetch('/api/auth/google/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refresh Google access token');
  }

  return response.json();
}

export async function validateGoogleAccessToken(accessToken: string): Promise<{ valid: boolean; account?: { email?: string; name?: string } }> {
  const { accessToken: resolvedAccessToken, uid } = await getManagedGoogleAccessToken('google-ads', accessToken);
  const response = await fetch('/api/google/validate', {
    headers: {
      'Authorization': `Bearer ${resolvedAccessToken}`,
      ...(uid ? { 'x-user-id': uid } : {}),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Google token validation failed');
  }

  return response.json();
}

export async function fetchGoogleCampaigns(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string,
  dateRange?: DateRangeParams
) {
  const resolved = await getManagedGoogleAccessToken('google-ads', accessToken);
  const search = new URLSearchParams({ customer_id: customerId });
  if (loginCustomerId) {
    search.set('login_customer_id', loginCustomerId);
  }
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/google/ads/campaigns?${search.toString()}`, {
    headers: {
      'Authorization': `Bearer ${resolved.accessToken}`,
      ...(resolved.uid ? { 'x-user-id': resolved.uid } : {}),
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
    return {
      id: c.id,
      name: c.name,
      platform: 'Google',
      status: c.status === 'ENABLED' ? 'Active' : 'Paused',
      spend: `₪${(parseFloat(m.costMicros || 0) / 1000000).toFixed(0)}`,
      roas: (parseFloat(m.conversions || 0) > 0 ? (parseFloat(m.costMicros || 0) / 1000000 / parseFloat(m.conversions)).toFixed(1) : '0.0'), // This is actually CPA-ish if we don't have conversion value
      cpa: `₪${(parseFloat(m.conversions || 0) > 0 ? (parseFloat(m.costMicros || 0) / 1000000 / parseFloat(m.conversions)).toFixed(0) : '0')}`
    };
  });
}

export async function fetchGoogleSearchTerms(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string,
  dateRange?: DateRangeParams
) {
  const resolved = await getManagedGoogleAccessToken('google-ads', accessToken);
  const search = new URLSearchParams({ customer_id: customerId });
  if (loginCustomerId) {
    search.set('login_customer_id', loginCustomerId);
  }
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/google/ads/search-terms?${search.toString()}`, {
    headers: {
      'Authorization': `Bearer ${resolved.accessToken}`,
      ...(resolved.uid ? { 'x-user-id': resolved.uid } : {}),
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch Google Ads search terms');
  }

  const data = await response.json();

  return (data.results || []).map((row: any) => {
    const term = row.searchTermView?.searchTerm || '(not set)';
    const clicks = Number(row.metrics?.clicks || 0);
    const cost = Number(row.metrics?.costMicros || 0) / 1_000_000;
    const conversions = Number(row.metrics?.conversions || 0);
    const conversionValue = Number(row.metrics?.conversionsValue || 0);
    const roas = cost > 0 ? conversionValue / cost : 0;
    const status = conversions <= 0 && clicks >= 20 ? 'negative_candidate' : roas >= 3 ? 'optimal' : 'review';

    return {
      type: 'ads',
      term,
      clicks,
      cost: Number(cost.toFixed(2)),
      conversions,
      roas: Number(roas.toFixed(2)),
      source: 'Google Ads',
      status,
    };
  });
}

export async function sendGmailNotification(accessToken: string, to: string, subject: string, body: string) {
  const resolved = await getManagedGoogleAccessToken('gmail', accessToken);
  const response = await fetch('/api/google/gmail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resolved.accessToken}`,
      ...(resolved.uid ? { 'x-user-id': resolved.uid } : {}),
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

export async function fetchGA4Report(accessToken: string, propertyId: string, dateRange?: DateRangeParams) {
  const resolved = await getManagedGoogleAccessToken('ga4', accessToken);
  const search = new URLSearchParams({ property_id: propertyId });
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/google/analytics/report?${search.toString()}`, {
    headers: {
      'Authorization': `Bearer ${resolved.accessToken}`,
      ...(resolved.uid ? { 'x-user-id': resolved.uid } : {}),
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch GA4 report');
  }

  return response.json();
}

export interface GoogleDiscoveryResult {
  discovered: {
    ga4PropertyId?: string;
    ga4PropertyName?: string;
    gscSiteUrl?: string;
    googleAdsId?: string;
  };
  warnings?: string[];
}

export async function fetchGoogleDiscovery(accessToken: string): Promise<GoogleDiscoveryResult> {
  const uid = await getActiveUid();
  const query = uid ? `?user_id=${encodeURIComponent(uid)}` : '';
  const headers: Record<string, string> = {};
  if (accessToken && accessToken !== 'server-managed') {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (uid) {
    headers['x-user-id'] = uid;
  }
  const response = await fetch(`/api/integrations/google/discover${query}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to discover Google resources');
  }

  return response.json();
}

export interface GA4LiveData {
  activeUsers: number;
  totalUsers: number;
  topPages: { name: string; users: number }[];
  trafficSources: { name: string; users: number; percent: number }[];
  propertyIdUsed?: string;
}

export interface DateRangeParams {
  startDate: string;
  endDate: string;
}

export async function fetchGA4LiveData(
  accessToken: string,
  propertyId?: string,
  dateRange?: DateRangeParams
): Promise<GA4LiveData> {
  const resolved = await getManagedGoogleAccessToken('ga4', accessToken);
  const search = new URLSearchParams();
  if (propertyId && String(propertyId).trim()) {
    search.set('property_id', String(propertyId).trim());
  }
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/google/analytics/live?${search.toString()}`, {
    headers: {
      'Authorization': `Bearer ${resolved.accessToken}`,
      ...(resolved.uid ? { 'x-user-id': resolved.uid } : {}),
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const attemptedPropertyIds = Array.isArray((error as any)?.attemptedPropertyIds)
      ? (error as any).attemptedPropertyIds.filter((id: unknown) => typeof id === 'string' && id.trim())
      : [];
    const attemptedSuffix =
      attemptedPropertyIds.length > 0 ? ` (attempted properties: ${attemptedPropertyIds.join(', ')})` : '';
    throw new Error(((error as any)?.message || 'Failed to fetch GA4 live data') + attemptedSuffix);
  }

  return response.json();
}

export async function fetchGSCData(accessToken: string, siteUrl: string, dateRange?: DateRangeParams) {
  const resolved = await getManagedGoogleAccessToken('search-console', accessToken);
  const search = new URLSearchParams({
    site_url: siteUrl,
  });
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/google/search-console/query?${search.toString()}`, {
    headers: {
      'Authorization': `Bearer ${resolved.accessToken}`,
      ...(resolved.uid ? { 'x-user-id': resolved.uid } : {}),
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch GSC data');
  }

  return response.json();
}
