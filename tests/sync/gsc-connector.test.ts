import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('@/src/lib/integrations/services/token-service', () => ({
  tokenService: {
    getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
  },
}));

vi.mock('@/src/lib/sync/jobs/http-retry', () => ({
  fetchWithRetry: vi.fn(),
}));

import { gscConnector } from '../../src/lib/sync/connectors/gsc';
import { fetchWithRetry } from '../../src/lib/sync/jobs/http-retry';

const mockFetch = fetchWithRetry as ReturnType<typeof vi.fn>;

const makeGscResponse = (rows: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>) =>
  new Response(
    JSON.stringify({
      rows: rows.map((r) => ({
        keys: [r.date],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
    }),
    { status: 200 }
  );

describe('gscConnector.fetchSearchMetricsByDay', () => {
  afterEach(() => vi.clearAllMocks());

  it('maps response rows to the correct shape', async () => {
    mockFetch.mockResolvedValueOnce(
      makeGscResponse([{ date: '2026-03-01', clicks: 120, impressions: 5000, ctr: 0.024, position: 8.5 }])
    );

    const rows = await gscConnector.fetchSearchMetricsByDay('conn1', 'https://example.com/', '2026-03-01', '2026-03-15');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-03-01', clicks: 120, impressions: 5000, ctr: 0.024, position: 8.5 });
  });

  it('returns empty array when API returns no rows', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    const rows = await gscConnector.fetchSearchMetricsByDay('conn1', 'https://example.com/', '2026-03-01', '2026-03-15');

    expect(rows).toEqual([]);
  });

  it('URL-encodes the siteUrl before calling the API', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));

    await gscConnector.fetchSearchMetricsByDay('conn1', 'https://example.com/', '2026-01-01', '2026-01-31');

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain(encodeURIComponent('https://example.com/'));
  });

  it('sends date and dimensions in the POST body', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));

    await gscConnector.fetchSearchMetricsByDay('conn1', 'https://site.com', '2026-02-01', '2026-02-28');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.startDate).toBe('2026-02-01');
    expect(body.endDate).toBe('2026-02-28');
    expect(body.dimensions).toContain('date');
  });
});
