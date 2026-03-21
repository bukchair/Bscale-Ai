import { tokenService } from '@/src/lib/integrations/services/token-service';
import { fetchWithRetry } from '@/src/lib/sync/jobs/http-retry';
import { TIKTOK_API_BASE } from '@/src/lib/constants/api-urls';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const tiktokAdsConnector = {
  async fetchCampaigns(connectionId: string, userId: string, advertiserId: string) {
    const accessToken = await tokenService.getAccessToken(connectionId, userId);
    const url = new URL(`${TIKTOK_API_BASE}/campaign/get/`);
    url.searchParams.set('advertiser_id', advertiserId);
    const response = await fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: {
        'Access-Token': accessToken,
      },
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || Number(payload?.code) !== 0) {
      throw new Error(String(payload?.message || '') || `TikTok campaigns fetch failed (${response.status})`);
    }
    const data = payload?.data as Record<string, unknown> | undefined;
    const rows = Array.isArray(data?.list) ? (data.list as Record<string, unknown>[]) : [];
    return rows.map((row) => ({
      id: String(row?.campaign_id || row?.id || ''),
      campaignId: String(row?.campaign_id || row?.id || ''),
      name: String(row?.campaign_name || row?.name || ''),
      status: String(row?.operation_status || row?.status || ''),
      objective: String(row?.objective_type || ''),
    }));
  },

  async fetchCampaignMetricsByDay(
    connectionId: string,
    userId: string,
    advertiserId: string,
    startDate: string,
    endDate: string
  ) {
    const accessToken = await tokenService.getAccessToken(connectionId, userId);
    const response = await fetchWithRetry(`${TIKTOK_API_BASE}/report/integrated/get/`, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        service_type: 'AUCTION',
        report_type: 'BASIC',
        data_level: 'AUCTION_CAMPAIGN',
        dimensions: ['campaign_id', 'stat_time_day'],
        metrics: ['impressions', 'clicks', 'spend', 'conversions', 'conversion_value'],
        start_date: startDate,
        end_date: endDate,
        page: 1,
        page_size: 1000,
      }),
    });
    const payload2 = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || Number(payload2?.code) !== 0) {
      throw new Error(String(payload2?.message || '') || `TikTok metrics fetch failed (${response.status})`);
    }
    const data2 = payload2?.data as Record<string, unknown> | undefined;
    const rows2 = Array.isArray(data2?.list) ? (data2.list as Record<string, unknown>[]) : [];
    return rows2.map((row) => {
      const dims = row?.dimensions as Record<string, unknown> | undefined;
      const mets = row?.metrics as Record<string, unknown> | undefined;
      return {
        campaignId: String(dims?.campaign_id || row?.campaign_id || ''),
        date: String(dims?.stat_time_day || row?.stat_time_day || endDate),
        impressions: Math.round(toNumber(mets?.impressions ?? row?.impressions)),
        clicks: Math.round(toNumber(mets?.clicks ?? row?.clicks)),
        spend: toNumber(mets?.spend ?? row?.spend),
        conversions: toNumber(mets?.conversions ?? row?.conversions),
        revenue: toNumber(mets?.conversion_value ?? row?.conversion_value),
      };
    });
  },
};
