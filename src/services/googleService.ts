const viteEnv =
  typeof import.meta !== 'undefined'
    ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ?? undefined)
    : undefined;

const API_BASE = (typeof viteEnv?.VITE_APP_URL === 'string' && viteEnv.VITE_APP_URL) || '';

export async function fetchGoogleAdAccounts(accessToken: string) {
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

export async function fetchGoogleCampaigns(accessToken: string, customerId: string, loginCustomerId?: string) {
  const response = await fetch(`${API_BASE}/api/google/ads/campaigns?customer_id=${customerId}${loginCustomerId ? `&login_customer_id=${loginCustomerId}` : ''}`, {
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

export async function sendGmailNotification(accessToken: string, to: string, subject: string, body: string) {
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

export async function fetchGA4Report(accessToken: string, propertyId: string) {
  const response = await fetch(`${API_BASE}/api/google/analytics/report?property_id=${propertyId}`, {
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

export async function fetchGSCData(accessToken: string, siteUrl: string) {
  const response = await fetch(`${API_BASE}/api/google/search-console/query?site_url=${encodeURIComponent(siteUrl)}`, {
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
