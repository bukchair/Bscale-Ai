const API_BASE =
  (typeof import.meta !== 'undefined' &&
    typeof import.meta.env.VITE_APP_URL === 'string' &&
    import.meta.env.VITE_APP_URL) ||
  '';

export async function fetchMetaAdAccounts(accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${accessToken}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Meta ad accounts');
  }
  
  const data = await response.json();
  return data.data;
}

export async function fetchMetaCampaigns(accessToken: string, adAccountId: string) {
  const response = await fetch(`${API_BASE}/api/meta/campaigns?ad_account_id=${adAccountId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Meta campaigns');
  }
  
  const data = await response.json();
  
  // Meta API returns data in a 'data' array
  return data.data.map((c: any) => {
    const insights = c.insights?.data?.[0] || {};
    const spend = parseFloat(insights.spend || 0) || 0;
    const conversions = parseFloat(c.conversions || 0) || 0;
    const cpa = conversions > 0 ? spend / conversions : 0;

    return {
      id: c.id,
      name: c.name,
      platform: 'Meta',
      status: c.status === 'ACTIVE' ? 'Active' : 'Paused',
      spend,
      roas: parseFloat(insights.roas?.[0]?.value || 0).toFixed(1),
      cpa,
    };
  });
}
