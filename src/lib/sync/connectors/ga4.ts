import { tokenService } from '@/src/lib/integrations/services/token-service';
import { fetchWithRetry } from '@/src/lib/sync/jobs/http-retry';

const GA4_DATA_API = 'https://analyticsdata.googleapis.com/v1beta';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// GA4 date format is YYYYMMDD — normalise to YYYY-MM-DD
const normaliseDate = (raw: string): string => {
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return raw;
};

export const ga4Connector = {
  /**
   * Fetch aggregated site-level metrics per day for a GA4 property.
   * Maps GA4 dimensions/metrics to a common row shape so callers
   * can store them like any other daily-metric series.
   */
  async fetchSiteMetricsByDay(
    connectionId: string,
    propertyId: string,
    startDate: string,
    endDate: string
  ) {
    const accessToken = await tokenService.getAccessToken(connectionId);

    const response = await fetchWithRetry(
      `${GA4_DATA_API}/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
            { name: 'eventCount' },
            { name: 'conversions' },
          ],
          limit: 1000,
        }),
      }
    );

    const payload = (await response.json().catch(() => ({}))) as any;
    const rows: any[] = Array.isArray(payload?.rows) ? payload.rows : [];

    return rows.map((row: any) => {
      const dim = (i: number) => String(row?.dimensionValues?.[i]?.value ?? '');
      const met = (i: number) => toNumber(row?.metricValues?.[i]?.value);
      return {
        date: normaliseDate(dim(0)),
        sessions: Math.round(met(0)),
        activeUsers: Math.round(met(1)),
        pageViews: Math.round(met(2)),
        eventCount: Math.round(met(3)),
        conversions: Math.round(met(4)),
      };
    });
  },
};
