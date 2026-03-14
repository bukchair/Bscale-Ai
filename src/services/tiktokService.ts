const API_BASE =
  (typeof import.meta !== 'undefined' &&
    typeof import.meta.env.VITE_APP_URL === 'string' &&
    import.meta.env.VITE_APP_URL) ||
  '';

export async function fetchTikTokCampaigns(accessToken: string, advertiserId: string) {
  const response = await fetch(`${API_BASE}/api/tiktok/campaigns?advertiser_id=${advertiserId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch TikTok campaigns');
  }
  
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(data.message || 'TikTok API error');
  }
  
  const list = Array.isArray(data?.data?.list) ? data.data.list : [];
  return list.map((c: any) => {
    const stats = c.stats || c.metrics || {};
    const spend = parseFloat(stats.spend ?? c.spend ?? 0) || 0;
    const conversions = parseFloat(stats.conversions ?? stats.convert ?? stats.conversion ?? c.conversions ?? 0) || 0;
    const conversionValue =
      parseFloat(stats.conversion_value ?? stats.convert_value ?? stats.revenue ?? c.conversion_value ?? 0) || 0;
    const roas = spend > 0 ? conversionValue / spend : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;

    return {
      id: c.campaign_id || c.id,
      name: c.campaign_name || c.name || `Campaign ${c.campaign_id || c.id || ''}`.trim(),
      platform: 'TikTok',
      status:
        c.operation_status === 'ENABLE' || c.status === 'ACTIVE' || c.status === 'ENABLE'
          ? 'Active'
          : 'Paused',
      spend,
      roas: Number.isFinite(roas) ? roas.toFixed(2) : '0.00',
      cpa,
      conversions,
      conversionValue,
    };
  });
}
