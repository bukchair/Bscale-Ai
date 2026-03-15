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
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  const startDateQuery = url.searchParams.get('start_date') || '';
  const endDateQuery = url.searchParams.get('end_date') || '';
  const startDate =
    DATE_PATTERN.test(startDateQuery) ? startDateQuery : null;
  const endDate =
    DATE_PATTERN.test(endDateQuery) ? endDateQuery : null;

  if (startDate && endDate) {
    // Meta insights rejects future dates; clamp to today.
    const clampedStart = startDate > todayIso ? todayIso : startDate;
    const clampedEnd = endDate > todayIso ? todayIso : endDate;
    return clampedStart <= clampedEnd
      ? { startDate: clampedStart, endDate: clampedEnd }
      : { startDate: clampedEnd, endDate: clampedStart };
  }

  const end = todayIso;
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
  const normalized = trimmed.replace(/^act_/i, '');
  return `act_${normalized}`;
};

const isRecoverableMetaRequestError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  const payload = error.response?.data as any;
  const code = Number(payload?.error?.code || 0);
  const message = String(payload?.error?.message || payload?.message || error.message || '').toLowerCase();
  if (status === 400 || status === 404) return true;
  if (code === 100 || code === 190) return true;
  return (
    message.includes('invalid parameter') ||
    message.includes('unsupported get request') ||
    message.includes('unknown path components')
  );
};

const discoverFirstMetaAdAccount = async (accessToken: string) => {
  const accountsResponse = await axios.get('https://graph.facebook.com/v19.0/me/adaccounts', {
    params: {
      fields: 'id,account_id,name',
      limit: 50,
      access_token: accessToken,
    },
  });
  const firstAccount = (accountsResponse.data?.data || [])[0];
  const discoveredId = String(firstAccount?.account_id || firstAccount?.id || '').trim();
  return discoveredId ? normalizeAdAccountId(discoveredId) : '';
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
      adAccountId = await discoverFirstMetaAdAccount(accessToken);
      if (!adAccountId) {
        return sendJson(res, 400, { message: 'No Meta ad account found for this token.' });
      }
    }

    let activeAdAccountId = adAccountId;
    let campaigns: any[] = [];
    try {
      const campaignsResponse = await axios.get(`https://graph.facebook.com/v19.0/${activeAdAccountId}/campaigns`, {
        params: {
          fields: 'id,name,status,objective,start_time,stop_time',
          limit: 500,
          access_token: accessToken,
        },
      });
      campaigns = Array.isArray(campaignsResponse.data?.data) ? campaignsResponse.data.data : [];
    } catch (campaignsError) {
      if (!isRecoverableMetaRequestError(campaignsError)) {
        throw campaignsError;
      }

      const discoveredFallbackId = await discoverFirstMetaAdAccount(accessToken).catch(() => '');
      if (!discoveredFallbackId || discoveredFallbackId === activeAdAccountId) {
        throw campaignsError;
      }

      activeAdAccountId = discoveredFallbackId;
      const fallbackCampaignsResponse = await axios.get(
        `https://graph.facebook.com/v19.0/${activeAdAccountId}/campaigns`,
        {
          params: {
            fields: 'id,name,status,objective,start_time,stop_time',
            limit: 500,
            access_token: accessToken,
          },
        }
      );
      campaigns = Array.isArray(fallbackCampaignsResponse.data?.data)
        ? fallbackCampaignsResponse.data.data
        : [];
    }
    const insightsByCampaign = new Map<string, any>();
    let liveMetricsAvailable = false;

    try {
      const insightsResponse = await axios.get(`https://graph.facebook.com/v19.0/${activeAdAccountId}/insights`, {
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
        adAccountId: activeAdAccountId,
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
