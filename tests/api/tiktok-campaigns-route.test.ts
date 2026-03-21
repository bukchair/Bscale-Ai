import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAuthenticatedUser = vi.fn();
const mockGetByUserPlatform = vi.fn();
const mockSaveDiscoveredAccounts = vi.fn();
const mockSetSelectedAccounts = vi.fn();
const mockGetAccessTokenForConnection = vi.fn();
const mockDiscoverAccounts = vi.fn();

vi.mock('@/src/lib/auth/session', () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
}));

vi.mock('@/src/lib/integrations/services/connection-service', () => ({
  connectionService: {
    getByUserPlatform: mockGetByUserPlatform,
    saveDiscoveredAccounts: mockSaveDiscoveredAccounts,
    setSelectedAccounts: mockSetSelectedAccounts,
  },
}));

vi.mock('@/src/lib/integrations/providers/tiktok/provider', () => ({
  TikTokProvider: vi.fn().mockImplementation(() => ({
    getAccessTokenForConnection: mockGetAccessTokenForConnection,
    discoverAccounts: mockDiscoverAccounts,
  })),
}));

vi.mock('@/src/lib/integrations/providers/meta/provider', () => ({
  MetaProvider: vi.fn().mockImplementation(() => ({
    getAccessTokenForConnection: vi.fn(),
    discoverAccounts: vi.fn(),
  })),
}));

vi.mock('@/src/lib/integrations/services/google-legacy-bridge', () => ({
  googleLegacyBridge: {
    getConnectionWithAccessToken: vi.fn(),
  },
}));

vi.mock('@/src/lib/integrations/utils/api-response', () => ({
  ok: (message: string, data: unknown, status = 200) =>
    Response.json(
      {
        success: true,
        message,
        data,
      },
      { status }
    ),
  toErrorResponse: (error: unknown, fallbackMessage = 'Unexpected server error.') =>
    Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : fallbackMessage,
      },
      { status: 500 }
    ),
}));

vi.mock('@/src/lib/integrations/services/integration-orchestrator', () => ({
  integrationOrchestrator: {
    startConnection: vi.fn(),
    handleCallback: vi.fn(),
    discoverAccounts: vi.fn(),
    testConnection: vi.fn(),
    syncNow: vi.fn(),
    selectAccounts: vi.fn(),
    disconnect: vi.fn(),
  },
}));

describe('GET /api/connections/tiktok/campaigns', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockGetAccessTokenForConnection.mockResolvedValue('real-tiktok-token');
    mockDiscoverAccounts.mockResolvedValue([]);
    mockSaveDiscoveredAccounts.mockResolvedValue(undefined);
    mockSetSelectedAccounts.mockResolvedValue(undefined);
  });

  it('uses managed token and selected advertiser when token is server-managed', async () => {
    mockGetByUserPlatform.mockResolvedValue({
      id: 'conn-1',
      connectedAccounts: [{ externalAccountId: '7011111111111111111', isSelected: true, status: 'ACTIVE' }],
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            list: [{ campaign_id: '123', campaign_name: 'TikTok Campaign A', operation_status: 'ENABLE' }],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            list: [
              {
                dimensions: { campaign_id: '123' },
                metrics: { spend: '11.5', conversions: '2', conversion_value: '90' },
              },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const { GET } = await import('../../src/app/api/connections/[platform]/[action]/route');
    const req = new Request(
      'http://localhost/api/connections/tiktok/campaigns?start_date=2026-03-01&end_date=2026-03-20',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer server-managed' },
      }
    );
    const res = await GET(req, { params: Promise.resolve({ platform: 'tiktok', action: 'campaigns' }) });
    const body = (await res.json()) as { data?: { list?: Array<{ stats?: { spend?: number } }> } };

    expect(res.status).toBe(200);
    expect(mockGetAccessTokenForConnection).toHaveBeenCalledWith('conn-1', 'user-1');
    expect(body.data?.list?.[0]?.stats?.spend).toBe(11.5);

    const firstUrl = String(fetchMock.mock.calls[0]?.[0] || '');
    const firstHeaders = fetchMock.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
    expect(firstUrl).toContain('campaign/get/?advertiser_id=7011111111111111111');
    expect(firstHeaders?.headers?.['Access-Token']).toBe('real-tiktok-token');

    fetchMock.mockRestore();
  });

  it('auto-discovers advertiser for managed connection when none is selected', async () => {
    mockGetByUserPlatform.mockResolvedValue({
      id: 'conn-2',
      connectedAccounts: [],
    });
    mockDiscoverAccounts.mockResolvedValue([
      { externalAccountId: '7022222222222222222', name: 'Advertiser 1', status: 'active' },
    ]);

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 0,
          data: { list: [] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const { GET } = await import('../../src/app/api/connections/[platform]/[action]/route');
    const req = new Request('http://localhost/api/connections/tiktok/campaigns', {
      method: 'GET',
      headers: { Authorization: 'Bearer server-managed' },
    });
    const res = await GET(req, { params: Promise.resolve({ platform: 'tiktok', action: 'campaigns' }) });

    expect(res.status).toBe(200);
    expect(mockSaveDiscoveredAccounts).toHaveBeenCalledWith(
      'user-1',
      'conn-2',
      'TIKTOK',
      expect.any(Array)
    );
    expect(mockSetSelectedAccounts).toHaveBeenCalledWith('user-1', 'conn-2', ['7022222222222222222']);
    const firstUrl = String(fetchMock.mock.calls[0]?.[0] || '');
    expect(firstUrl).toContain('campaign/get/?advertiser_id=7022222222222222222');

    fetchMock.mockRestore();
  });
});

