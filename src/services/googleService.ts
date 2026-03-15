export async function fetchGoogleAdAccounts(accessToken: string) {
  const response = await fetch(`/api/google/discover`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
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
  const response = await fetch('/api/google/validate', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
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

export async function sendGmailNotification(accessToken: string, to: string, subject: string, body: string) {
  const response = await fetch('/api/google/gmail/send', {
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

export async function fetchGA4Report(accessToken: string, propertyId: string, dateRange?: DateRangeParams) {
  const search = new URLSearchParams({ property_id: propertyId });
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/google/analytics/report?${search.toString()}`, {
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
  const response = await fetch(`/api/google/discover`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
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
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch GA4 live data');
  }

  return response.json();
}

export async function fetchGSCData(accessToken: string, siteUrl: string, dateRange?: DateRangeParams) {
  const search = new URLSearchParams({
    site_url: siteUrl,
  });
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/google/search-console/query?${search.toString()}`, {
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
