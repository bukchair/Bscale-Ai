import { API_BASE } from '../lib/utils/client-api-base';

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

  const response = await fetch(`${API_BASE}/api/connections/tiktok/campaigns?${query.toString()}`, {
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
  
  type TikTokCampaignRow = {
    campaign_id?: string | number;
    id?: string | number;
    campaign_name?: string;
    name?: string;
    operation_status?: string;
    status?: string;
    spend?: number;
    conversions?: number;
    conversion_value?: number;
    stats?: Record<string, number | string>;
    metrics?: Record<string, number | string>;
  };
  const list: TikTokCampaignRow[] = Array.isArray(data?.data?.list) ? (data.data.list as TikTokCampaignRow[]) : [];
  return list.map((c) => {
    const stats = (c.stats || c.metrics || {}) as Record<string, number | string>;
    const spend = parseFloat(String(stats.spend ?? c.spend ?? 0)) || 0;
    const conversions = parseFloat(String(stats.conversions ?? stats.convert ?? stats.conversion ?? c.conversions ?? 0)) || 0;
    const conversionValue =
      parseFloat(String(stats.conversion_value ?? stats.convert_value ?? stats.revenue ?? c.conversion_value ?? 0)) || 0;
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
