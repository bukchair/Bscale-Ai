import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock the token service so the connector doesn't need a real DB.
vi.mock('@/src/lib/integrations/services/token-service', () => ({
  tokenService: {
    getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
  },
}));

// Mock fetchWithRetry so we control the API response.
vi.mock('@/src/lib/sync/jobs/http-retry', () => ({
  fetchWithRetry: vi.fn(),
}));

import { ga4Connector } from '../../src/lib/sync/connectors/ga4';
import { fetchWithRetry } from '../../src/lib/sync/jobs/http-retry';

const mockFetch = fetchWithRetry as ReturnType<typeof vi.fn>;

const makeGa4Response = (rows: Array<{ date: string; values: number[] }>) =>
  new Response(
    JSON.stringify({
      rows: rows.map(({ date, values }) => ({
        dimensionValues: [{ value: date }],
        metricValues: values.map((v) => ({ value: String(v) })),
      })),
    }),
    { status: 200 }
  );

describe('ga4Connector.fetchSiteMetricsByDay', () => {
  afterEach(() => vi.clearAllMocks());

  it('normalises YYYYMMDD date strings to YYYY-MM-DD', async () => {
    mockFetch.mockResolvedValueOnce(makeGa4Response([{ date: '20260101', values: [100, 80, 500, 1200, 5] }]));

    const rows = await ga4Connector.fetchSiteMetricsByDay('conn1', '123456789', '2026-01-01', '2026-01-07');

    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-01-01');
  });

  it('maps metric values to the correct fields', async () => {
    mockFetch.mockResolvedValueOnce(makeGa4Response([{ date: '20260315', values: [250, 180, 900, 3000, 12] }]));

    const rows = await ga4Connector.fetchSiteMetricsByDay('conn1', '123456789', '2026-03-15', '2026-03-15');

    expect(rows[0]).toMatchObject({
      sessions: 250,
      activeUsers: 180,
      pageViews: 900,
      eventCount: 3000,
      conversions: 12,
    });
  });

  it('returns empty array when API returns no rows', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    const rows = await ga4Connector.fetchSiteMetricsByDay('conn1', '123456789', '2026-01-01', '2026-01-07');

    expect(rows).toEqual([]);
  });

  it('passes the property ID and date range to the GA4 Data API', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));

    await ga4Connector.fetchSiteMetricsByDay('conn1', '987654321', '2026-02-01', '2026-02-28');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('properties/987654321:runReport');
    const body = JSON.parse(init.body as string);
    expect(body.dateRanges[0]).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
  });
});
