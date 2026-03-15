export async function fetchMetaAdAccounts(accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${accessToken}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Meta ad accounts');
  }
  
  const data = await response.json();
  return data.data;
}

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

const extractConversionCount = (actions: unknown): number => {
  if (!Array.isArray(actions)) return 0;
  const preferredActionTypes = new Set([
    'purchase',
    'offsite_conversion.purchase',
    'onsite_web_purchase',
    'lead',
    'onsite_conversion.lead_grouped',
  ]);

  let total = 0;
  for (const item of actions) {
    const action = item as { action_type?: unknown; value?: unknown };
    if (!preferredActionTypes.has(String(action?.action_type || ''))) continue;
    total += toNumber(action?.value);
  }
  return total;
};

export async function fetchMetaCampaigns(
  accessToken: string,
  adAccountId: string,
  dateRange?: DateRangeParams
) {
  const search = new URLSearchParams({ ad_account_id: adAccountId });
  if (dateRange) {
    search.set('start_date', dateRange.startDate);
    search.set('end_date', dateRange.endDate);
  }

  const response = await fetch(`/api/meta/campaigns?${search.toString()}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch Meta campaigns');
  }
  
  const data = await response.json();
  
  // Meta API returns data in a 'data' array
  return data.data.map((c: any) => {
    const insights = c.insights?.data?.[0] || {};
    const spend = toNumber(insights.spend);
    const conversions = extractConversionCount(insights.actions);
    const rawRoas = toNumber(insights.purchase_roas?.[0]?.value) || toNumber(insights.roas?.[0]?.value);
    const cpa = conversions > 0 ? spend / conversions : 0;

    return {
      id: c.id,
      name: c.name,
      platform: 'Meta',
      status: c.status === 'ACTIVE' ? 'Active' : 'Paused',
      spend: `₪${spend.toFixed(0)}`,
      roas: rawRoas.toFixed(1),
      cpa: `₪${cpa.toFixed(0)}`
    };
  });
}
