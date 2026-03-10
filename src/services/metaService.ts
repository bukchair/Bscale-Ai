export async function fetchMetaCampaigns(accessToken: string, adAccountId: string) {
  const response = await fetch(`/api/meta/campaigns?ad_account_id=${adAccountId}`, {
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
    return {
      id: c.id,
      name: c.name,
      platform: 'Meta',
      status: c.status === 'ACTIVE' ? 'Active' : 'Paused',
      spend: `₪${parseFloat(insights.spend || 0).toFixed(0)}`,
      roas: parseFloat(insights.roas?.[0]?.value || 0).toFixed(1),
      cpa: `₪${(parseFloat(insights.spend || 0) / (parseFloat(c.conversions || 1) || 1)).toFixed(0)}` // Rough estimation if conversions not present
    };
  });
}
