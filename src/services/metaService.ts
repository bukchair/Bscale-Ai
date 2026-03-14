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
    const actions = Array.isArray(insights.actions) ? insights.actions : [];
    const actionValues = Array.isArray(insights.action_values) ? insights.action_values : [];
    const conversionActionTypes = new Set([
      'purchase',
      'offsite_conversion.purchase',
      'omni_purchase',
      'onsite_conversion.purchase',
      'lead',
      'offsite_conversion.fb_pixel_lead',
    ]);
    const conversionValueTypes = new Set([
      'purchase',
      'offsite_conversion.purchase',
      'omni_purchase',
      'onsite_conversion.purchase',
    ]);
    const conversions = actions.reduce((sum: number, action: any) => {
      if (!action || !conversionActionTypes.has(String(action.action_type || ''))) return sum;
      const v = parseFloat(action.value || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const conversionValue = actionValues.reduce((sum: number, action: any) => {
      if (!action || !conversionValueTypes.has(String(action.action_type || ''))) return sum;
      const v = parseFloat(action.value || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const cpa = conversions > 0 ? spend / conversions : 0;
    const roasFromInsight =
      Array.isArray(insights.purchase_roas) && insights.purchase_roas[0]?.value != null
        ? parseFloat(insights.purchase_roas[0].value || 0)
        : Array.isArray(insights.roas) && insights.roas[0]?.value != null
        ? parseFloat(insights.roas[0].value || 0)
        : 0;
    const roas = roasFromInsight > 0 ? roasFromInsight : spend > 0 ? conversionValue / spend : 0;

    return {
      id: c.id,
      name: c.name,
      platform: 'Meta',
      status: c.status === 'ACTIVE' ? 'Active' : 'Paused',
      spend,
      roas: Number.isFinite(roas) ? roas.toFixed(2) : '0.00',
      cpa,
      conversions,
      conversionValue,
    };
  });
}
