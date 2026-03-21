import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAuthenticatedUser = vi.fn();
const mockGetByUserPlatform = vi.fn();
const mockCreateGoogleDraft = vi.fn();
const mockCreateMetaDraft = vi.fn();
const mockCreateTikTokDraft = vi.fn();

vi.mock('@/src/lib/auth/session', () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
}));

vi.mock('@/src/lib/integrations/services/connection-service', () => ({
  connectionService: {
    getByUserPlatform: mockGetByUserPlatform,
  },
}));

vi.mock('@/src/lib/one-click/builders/google', () => ({
  createGoogleDraft: mockCreateGoogleDraft,
}));

vi.mock('@/src/lib/one-click/builders/meta', () => ({
  createMetaDraft: mockCreateMetaDraft,
}));

vi.mock('@/src/lib/one-click/builders/tiktok', () => ({
  createTikTokDraft: mockCreateTikTokDraft,
}));

const importRoute = async () => import('../../src/app/api/campaigns/scheduled/route');

describe('POST /api/campaigns/scheduled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockRequireAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mockGetByUserPlatform.mockResolvedValue(null);

    mockCreateGoogleDraft.mockResolvedValue({
      ok: true,
      campaignId: 'g-1',
      adId: 'ga-1',
      message: 'Google Ads campaign + ad group + RSA created.',
      campaignStatus: 'Draft',
    });
    mockCreateMetaDraft.mockResolvedValue({
      ok: true,
      campaignId: 'm-1',
      adId: 'ma-1',
      message: 'Meta campaign + ad set + ad created.',
      campaignStatus: 'Draft',
    });
    mockCreateTikTokDraft.mockResolvedValue({
      ok: true,
      campaignId: 't-1',
      adId: 'ta-1',
      message: 'TikTok campaign + ad group + ad created.',
      campaignStatus: 'Draft',
    });
  });

  it('creates full hierarchy across all selected platforms', async () => {
    const dayByJs = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const now = new Date();
    const currentDay = dayByJs[now.getDay()];
    const currentHour = now.getHours();
    const req = new Request('http://localhost/api/campaigns/scheduled', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignName: 'My Campaign',
        shortTitle: 'My Short Title',
        brief: 'Great product brief',
        objective: 'awareness',
        dailyBudget: 29,
        country: 'IL',
        platforms: ['Google', 'Meta', 'TikTok'],
        audiences: ['Audience A'],
        platformCopyDrafts: {
          Google: { title: 'G title', description: 'G desc' },
          Meta: { title: 'M title', description: 'M desc' },
          TikTok: { title: 'T title', description: 'T desc' },
        },
        weeklySchedule: {
          Google: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], [currentDay]: [currentHour] },
          Meta: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], [currentDay]: [currentHour] },
          TikTok: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], [currentDay]: [currentHour] },
        },
      }),
    });

    const { POST } = await importRoute();
    const res = await POST(req);
    const body = (await res.json()) as {
      success: boolean;
      createdCount: number;
      failedCount: number;
      results: Array<{ platform: string; ok: boolean }>;
    };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.createdCount).toBe(3);
    expect(body.failedCount).toBe(0);
    expect(body.results.every((row) => row.ok)).toBe(true);

    expect(mockCreateGoogleDraft).toHaveBeenCalledTimes(1);
    expect(mockCreateMetaDraft).toHaveBeenCalledTimes(1);
    expect(mockCreateTikTokDraft).toHaveBeenCalledTimes(1);

    // awareness -> traffic mapping for one-click builders
    expect(mockCreateGoogleDraft.mock.calls[0][2]).toBe('traffic');
    // activeNow derived from weekly schedule should be true here
    expect(mockCreateGoogleDraft.mock.calls[0][5]).toBe(true);
  });

  it('marks result as failed when builder returns incomplete hierarchy', async () => {
    mockCreateTikTokDraft.mockResolvedValueOnce({
      ok: true,
      campaignId: 't-2',
      message: 'TikTok campaign + ad group created. No image available - ad skipped.',
      campaignStatus: 'Draft',
    });

    const req = new Request('http://localhost/api/campaigns/scheduled', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignName: 'TikTok only',
        objective: 'sales',
        platforms: ['TikTok'],
      }),
    });

    const { POST } = await importRoute();
    const res = await POST(req);
    const body = (await res.json()) as {
      success: boolean;
      createdCount: number;
      failedCount: number;
      results: Array<{ platform: string; ok: boolean; message: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.createdCount).toBe(0);
    expect(body.failedCount).toBe(1);
    expect(body.results[0]?.platform).toBe('TikTok');
    expect(body.results[0]?.ok).toBe(false);
  });

  it('passes multipart media to Meta builder', async () => {
    const form = new FormData();
    form.append(
      'body',
      JSON.stringify({
        campaignName: 'Meta media campaign',
        objective: 'sales',
        platforms: ['Meta'],
        product: {
          name: 'Product X',
          url: 'https://example.com/p/x',
        },
      })
    );
    form.append(
      'media',
      new File([new Uint8Array([1, 2, 3, 4])], 'creative.jpg', { type: 'image/jpeg' })
    );

    const req = new Request('http://localhost/api/campaigns/scheduled', {
      method: 'POST',
      body: form,
    });

    const { POST } = await importRoute();
    const res = await POST(req);
    const body = (await res.json()) as { success: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateMetaDraft).toHaveBeenCalledTimes(1);

    const args = mockCreateMetaDraft.mock.calls[0];
    expect(Buffer.isBuffer(args[8])).toBe(true);
    expect(args[9]).toBe('image/jpeg');
  });
});

