import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';

type Req = IncomingMessage & { query?: Record<string, string> };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseUrl = (req: IncomingMessage) => {
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  return new URL(req.url || '/', `${proto}://${host}`);
};

const getDateRangeFromQuery = (url: URL, defaultDays = 30) => {
  const startDateQuery = url.searchParams.get('start_date') || '';
  const endDateQuery = url.searchParams.get('end_date') || '';
  const startDate =
    DATE_PATTERN.test(startDateQuery) ? startDateQuery : null;
  const endDate =
    DATE_PATTERN.test(endDateQuery) ? endDateQuery : null;

  if (startDate && endDate) {
    return startDate <= endDate
      ? { startDate, endDate }
      : { startDate: endDate, endDate: startDate };
  }

  const today = new Date();
  const end = today.toISOString().split('T')[0];
  const start = new Date(today);
  start.setDate(start.getDate() - (defaultDays - 1));
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end,
  };
};

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as any;
    return payload?.error?.message || payload?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const normalizeAdAccountId = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
};

const pickRoas = (insight: any): number => {
  const roasA = Number.parseFloat(String(insight?.purchase_roas?.[0]?.value || '0'));
  const roasB = Number.parseFloat(String(insight?.roas?.[0]?.value || '0'));
  if (Number.isFinite(roasA) && roasA > 0) return roasA;
  if (Number.isFinite(roasB) && roasB > 0) return roasB;
  return 0;
};

export default async function handler(req: Req, res: ServerResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const url = parseUrl(req);
  const accessToken = req.headers.authorization?.split(' ')[1] || '';
  const { startDate, endDate } = getDateRangeFromQuery(url, 30);
  let adAccountId = normalizeAdAccountId(url.searchParams.get('ad_account_id') || '');

  if (!accessToken) {
    return sendJson(res, 400, { message: 'Missing Meta access token' });
  }

  try {
    if (!adAccountId) {
      const accountsResponse = await axios.get('https://graph.facebook.com/v19.0/me/adaccounts', {
        params: {
          fields: 'account_id,name',
          limit: 50,
          access_token: accessToken,
        },
      });
      const firstAccount = (accountsResponse.data?.data || [])[0];
      const discoveredId = String(firstAccount?.account_id || '').trim();
      if (!discoveredId) {
        return sendJson(res, 400, { message: 'No Meta ad account found for this token.' });
      }
      adAccountId = normalizeAdAccountId(discoveredId);
    }

    const campaignsResponse = await axios.get(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns`, {
      params: {
        fields: 'id,name,status,objective,start_time,stop_time',
        limit: 500,
        access_token: accessToken,
      },
    });

    const campaigns = Array.isArray(campaignsResponse.data?.data) ? campaignsResponse.data.data : [];
    const insightsByCampaign = new Map<string, any>();
    let liveMetricsAvailable = false;

    try {
      const insightsResponse = await axios.get(`https://graph.facebook.com/v19.0/${adAccountId}/insights`, {
        params: {
          level: 'campaign',
          fields: 'campaign_id,campaign_name,spend,actions,purchase_roas,roas',
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          limit: 500,
          access_token: accessToken,
        },
      });

      const insights = Array.isArray(insightsResponse.data?.data) ? insightsResponse.data.data : [];
      liveMetricsAvailable = insights.length > 0;
      insights.forEach((row) => {
        const campaignId = String((row as any)?.campaign_id || '').trim();
        if (!campaignId) return;
        insightsByCampaign.set(campaignId, row);
      });
    } catch {
      // Return campaigns even when insights fails.
    }

    const merged = campaigns.map((campaign: any) => {
      const insight = insightsByCampaign.get(String(campaign?.id || ''));
      return {
        ...campaign,
        insights: {
          data: [
            insight || {
              spend: '0',
              actions: [],
              purchase_roas: [{ value: '0' }],
              roas: [{ value: '0' }],
            },
          ],
        },
        computed: {
          roas: pickRoas(insight),
        },
      };
    });

    return sendJson(res, 200, {
      data: merged,
      meta: {
        adAccountId,
        liveMetricsAvailable,
        dateRange: { startDate, endDate },
      },
    });
  } catch (error) {
    return sendJson(res, 500, {
      message: getErrorMessage(error, 'Failed to fetch Meta campaigns'),
    });
  }
}
