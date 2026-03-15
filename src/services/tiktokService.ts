export interface DateRangeParams {
  startDate: string;
  endDate: string;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export async function fetchTikTokCampaigns(
  accessToken: string,
  advertiserId: string,
  dateRange?: DateRangeParams
) {
  const search = new URLSearchParams({ advertiser_id: advertiserId });
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/tiktok/campaigns?${search.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch TikTok campaigns');
  }
  
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(data.message || 'TikTok API error');
  }
  
  const campaigns = Array.isArray(data?.data?.list) ? data.data.list : [];
  return campaigns.map((campaign: any) => {
    const spend = toNumber(campaign?.spend);
    const conversions = toNumber(campaign?.conversions ?? campaign?.conversion);
    const roas = toNumber(campaign?.roas);
    const cpa = conversions > 0 ? spend / conversions : 0;

    return {
      id: campaign?.campaign_id || campaign?.id,
      name: campaign?.campaign_name || campaign?.name || 'TikTok Campaign',
      platform: 'TikTok',
      status: campaign?.operation_status === 'ENABLE' || campaign?.status === 'ACTIVE' ? 'Active' : 'Paused',
      spend: `₪${spend.toFixed(0)}`,
      roas: roas.toFixed(1),
      cpa: `₪${cpa.toFixed(0)}`,
    };
  });
}
