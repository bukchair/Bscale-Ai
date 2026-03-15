import { auth, onAuthStateChanged } from '../lib/firebase';

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

const ensureManagedApiSession = async (accessToken: string) => {
  if (accessToken !== 'server-managed') return;
  const user =
    auth.currentUser ||
    (await new Promise<typeof auth.currentUser>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        unsubscribe();
        resolve(auth.currentUser);
      }, 3000);
      const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        resolve(nextUser);
      });
    }));
  if (!user) return;
  const idToken = await user.getIdToken();
  await fetch(`${API_BASE}/api/auth/session/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
};

export async function fetchMetaAdAccounts(accessToken: string) {
  await ensureManagedApiSession(accessToken);

  if (accessToken === 'server-managed') {
    const managedResponse = await fetch(`${API_BASE}/api/connections/meta/accounts`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    const managedPayload = await managedResponse.json().catch(() => null);
    if (!managedResponse.ok || !managedPayload?.success) {
      throw new Error(managedPayload?.message || 'Failed to fetch managed Meta ad accounts');
    }

    const accounts = Array.isArray(managedPayload?.data?.accounts) ? managedPayload.data.accounts : [];
    return accounts.map((account: any) => ({
      id: account.externalAccountId,
      account_id: account.externalAccountId,
      name: account.name || account.externalAccountId,
      currency: account.currency || undefined,
      timezone_name: account.timezone || undefined,
      status: account.status,
      isSelected: Boolean(account.isSelected),
    }));
  }

  const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${accessToken}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Meta ad accounts');
  }
  
  const data = await response.json();
  return data.data;
}

export async function fetchMetaCampaigns(
  accessToken: string,
  adAccountId?: string,
  startDate?: string,
  endDate?: string
) {
  await ensureManagedApiSession(accessToken);

  const query = new URLSearchParams();
  if (adAccountId) query.set('ad_account_id', adAccountId);
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);

  const response = await fetch(`${API_BASE}/api/connections/meta/campaigns?${query.toString()}`, {
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
