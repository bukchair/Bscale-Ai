import { tokenService } from '@/src/lib/integrations/services/token-service';
import { fetchWithRetry } from '@/src/lib/sync/jobs/http-retry';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeAccountId = (value: string) => {
  const digits = String(value || '').replace(/^act_/i, '').replace(/\D/g, '');
  return digits ? `act_${digits}` : String(value || '');
};

export const metaAdsConnector = {
  async fetchCampaigns(connectionId: string, adAccountId: string) {
    const accessToken = await tokenService.getAccessToken(connectionId);
    const accountId = normalizeAccountId(adAccountId);
    const url = new URL(`${META_GRAPH_BASE}/${accountId}/campaigns`);
    url.searchParams.set(
      'fields',
      'id,name,status,effective_status,objective,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget'
    );
    url.searchParams.set('limit', '200');
    url.searchParams.set('access_token', accessToken);

    const response = await fetchWithRetry(url.toString(), { method: 'GET' });
    const payload = (await response.json().catch(() => ({}))) as any;
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows.map((row: any) => ({
      id: String(row?.id || ''),
      campaignId: String(row?.id || ''),
      name: String(row?.name || ''),
      status: String(row?.effective_status || row?.status || ''),
      objective: String(row?.objective || ''),
      startDate: String(row?.start_time || ''),
      endDate: String(row?.stop_time || ''),
      dailyBudget: toNumber(row?.daily_budget) / 100,
      lifetimeBudget: toNumber(row?.lifetime_budget) / 100,
    }));
  },

  async fetchCampaignMetricsByDay(
    connectionId: string,
    adAccountId: string,
    startDate: string,
    endDate: string
  ) {
    const accessToken = await tokenService.getAccessToken(connectionId);
    const accountId = normalizeAccountId(adAccountId);
    const url = new URL(`${META_GRAPH_BASE}/${accountId}/insights`);
    url.searchParams.set(
      'fields',
      'campaign_id,date_start,impressions,clicks,spend,actions,action_values'
    );
    url.searchParams.set('level', 'campaign');
    url.searchParams.set('time_increment', '1');
    url.searchParams.set(
      'time_range',
      JSON.stringify({
        since: startDate,
        until: endDate,
      })
    );
    url.searchParams.set('limit', '500');
    url.searchParams.set('access_token', accessToken);

    const response = await fetchWithRetry(url.toString(), { method: 'GET' });
    const payload = (await response.json().catch(() => ({}))) as any;
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    return rows.map((row: any) => {
      const actions = Array.isArray(row?.actions) ? row.actions : [];
      const actionValues = Array.isArray(row?.action_values) ? row.action_values : [];
      const conversions = actions.reduce((sum: number, action: any) => {
        const key = String(action?.action_type || '').toLowerCase();
        if (!key.includes('purchase') && !key.includes('lead') && !key.includes('messaging')) return sum;
        return sum + toNumber(action?.value);
      }, 0);
      const revenue = actionValues.reduce((sum: number, action: any) => {
        const key = String(action?.action_type || '').toLowerCase();
        if (!key.includes('purchase')) return sum;
        return sum + toNumber(action?.value);
      }, 0);
      return {
        campaignId: String(row?.campaign_id || ''),
        date: String(row?.date_start || ''),
        impressions: Math.round(toNumber(row?.impressions)),
        clicks: Math.round(toNumber(row?.clicks)),
        spend: toNumber(row?.spend),
        conversions,
        revenue,
      };
    });
  },
};
