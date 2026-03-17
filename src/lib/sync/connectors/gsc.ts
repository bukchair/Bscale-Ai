import { tokenService } from '@/src/lib/integrations/services/token-service';
import { fetchWithRetry } from '@/src/lib/sync/jobs/http-retry';

const SEARCH_CONSOLE_API = 'https://searchconsole.googleapis.com/webmasters/v3';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const gscConnector = {
  /**
   * Fetch aggregated search-performance metrics per day for a Search Console site.
   * Each row covers all queries/pages for that day, rolled up into site-level totals.
   */
  async fetchSearchMetricsByDay(
    connectionId: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ) {
    const accessToken = await tokenService.getAccessToken(connectionId);
    const encodedSite = encodeURIComponent(siteUrl);

    const response = await fetchWithRetry(
      `${SEARCH_CONSOLE_API}/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['date'],
          rowLimit: 1000,
          startRow: 0,
        }),
      }
    );

    const payload = (await response.json().catch(() => ({}))) as any;
    const rows: any[] = Array.isArray(payload?.rows) ? payload.rows : [];

    return rows.map((row: any) => ({
      date: String(row?.keys?.[0] ?? ''),
      clicks: Math.round(toNumber(row?.clicks)),
      impressions: Math.round(toNumber(row?.impressions)),
      ctr: toNumber(row?.ctr),
      position: toNumber(row?.position),
    }));
  },
};
