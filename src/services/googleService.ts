export async function fetchGoogleCampaigns(accessToken: string, customerId: string, loginCustomerId?: string) {
  const response = await fetch(`/api/google/ads/campaigns?customer_id=${customerId}${loginCustomerId ? `&login_customer_id=${loginCustomerId}` : ''}`, {
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

export async function fetchGA4Report(accessToken: string, propertyId: string) {
  const response = await fetch(`/api/google/analytics/report?property_id=${propertyId}`, {
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
  const response = await fetch(`/api/google/search-console/query?site_url=${encodeURIComponent(siteUrl)}`, {
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
