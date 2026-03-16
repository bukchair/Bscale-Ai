import { tokenService } from '@/src/lib/integrations/services/token-service';
import { fetchWithRetry } from '@/src/lib/sync/jobs/http-retry';

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const tiktokAdsConnector = {
  async fetchCampaigns(connectionId: string, advertiserId: string) {
    const accessToken = await tokenService.getAccessToken(connectionId);
    const url = new URL(`${TIKTOK_API_BASE}/campaign/get/`);
    url.searchParams.set('advertiser_id', advertiserId);
    const response = await fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: {
        'Access-Token': accessToken,
      },
    });
    const payload = (await response.json().catch(() => ({}))) as any;
    const rows = Array.isArray(payload?.data?.list) ? payload.data.list : [];
    return rows.map((row: any) => ({
      id: String(row?.campaign_id || row?.id || ''),
      campaignId: String(row?.campaign_id || row?.id || ''),
      name: String(row?.campaign_name || row?.name || ''),
      status: String(row?.operation_status || row?.status || ''),
      objective: String(row?.objective_type || ''),
    }));
  },

  async fetchCampaignMetricsByDay(
    connectionId: string,
    advertiserId: string,
    startDate: string,
    endDate: string
  ) {
    const accessToken = await tokenService.getAccessToken(connectionId);
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
    const payload = (await response.json().catch(() => ({}))) as any;
    const rows = Array.isArray(payload?.data?.list) ? payload.data.list : [];
    return rows.map((row: any) => ({
      campaignId: String(row?.dimensions?.campaign_id || row?.campaign_id || ''),
      date: String(row?.dimensions?.stat_time_day || row?.stat_time_day || endDate),
      impressions: Math.round(toNumber(row?.metrics?.impressions || row?.impressions)),
      clicks: Math.round(toNumber(row?.metrics?.clicks || row?.clicks)),
      spend: toNumber(row?.metrics?.spend || row?.spend),
      conversions: toNumber(row?.metrics?.conversions || row?.conversions),
      revenue: toNumber(row?.metrics?.conversion_value || row?.conversion_value),
    }));
  },
};
