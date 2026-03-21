import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAuthenticatedUser = vi.fn();
const mockGetConnectionWithAccessToken = vi.fn();

vi.mock('@/src/lib/auth/session', () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
}));

vi.mock('@/src/lib/integrations/services/google-legacy-bridge', () => ({
  googleLegacyBridge: {
    getConnectionWithAccessToken: mockGetConnectionWithAccessToken,
  },
}));

describe('GET /api/google/analytics/realtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockRequireAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockGetConnectionWithAccessToken.mockResolvedValue({
      accessToken: 'token',
      resolvedPlatform: 'GA4',
      connection: {
        connectedAccounts: [
          { externalAccountId: '414094230', isSelected: true, status: 'ACTIVE' },
        ],
      },
    });
  });

  it('retries with auto-discovered property when provided property fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    // First attempt (bad property)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: 'The specified property does not exist.' } }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ totals: [{ metricValues: [{ value: '0' }] }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    // Discovery
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accountSummaries: [
            {
              propertySummaries: [{ property: 'properties/123456789' }],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    // Second attempt (discovered property)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          rows: [
            {
              dimensionValues: [{ value: 'Home' }, { value: '/' }],
              metricValues: [{ value: '7' }],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ totals: [{ metricValues: [{ value: '25' }] }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const { GET } = await import('../../src/app/api/google/analytics/realtime/route');
    const req = new Request(
      'http://localhost/api/google/analytics/realtime?property_id=414094230',
      { method: 'GET' }
    );
    const res = await GET(req);
    const body = (await res.json()) as { topPages?: Array<{ path: string }>; users24h?: number };

    expect(res.status).toBe(200);
    expect(body.users24h).toBe(25);
    expect(body.topPages?.[0]?.path).toBe('/');

    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0] || ''));
    expect(calledUrls.some((url) => url.includes('/properties/123456789:runRealtimeReport'))).toBe(true);

    fetchMock.mockRestore();
  });
});

