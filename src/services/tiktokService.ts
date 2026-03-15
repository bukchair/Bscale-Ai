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

export async function fetchTikTokCampaigns(
  accessToken: string,
  advertiserId: string,
  startDate?: string,
  endDate?: string
) {
  const query = new URLSearchParams();
  query.set('advertiser_id', advertiserId);
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);

  const response = await fetch(`${API_BASE}/api/tiktok/campaigns?${query.toString()}`, {
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
