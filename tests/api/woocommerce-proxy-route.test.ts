import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAuthenticatedUser = vi.fn();

vi.mock('@/src/lib/auth/session', () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
}));

describe('POST /api/proxy/woocommerce', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
  });

  it('accepts safe query-string endpoint paths', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    const { POST } = await import('../../src/app/api/proxy/woocommerce/route');
    const req = new Request('http://localhost/api/proxy/woocommerce', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://shop.example.com',
        key: 'ck_123',
        secret: 'cs_456',
        endpoint: 'reports/sales?period=month',
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok?: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstUrl = String(fetchMock.mock.calls[0]?.[0] || '');
    expect(firstUrl).toContain('/wp-json/wc/v3/reports/sales?period=month');

    fetchMock.mockRestore();
  });

  it('rejects unsafe absolute endpoint URLs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const { POST } = await import('../../src/app/api/proxy/woocommerce/route');
    const req = new Request('http://localhost/api/proxy/woocommerce', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://shop.example.com',
        key: 'ck_123',
        secret: 'cs_456',
        endpoint: 'https://evil.example/x',
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { message?: string };

    expect(res.status).toBe(400);
    expect(String(body.message || '').toLowerCase()).toContain('invalid endpoint');
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRestore();
  });
});

