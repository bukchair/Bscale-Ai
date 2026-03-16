import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/auth/session', () => ({
  requireAuthenticatedUser: vi.fn(async () => ({ id: 'u1', email: 'u1@test.com' })),
}));

vi.mock('../../src/lib/sync/cache/cache-client', () => ({
  cacheClient: {
    getJson: vi.fn(async () => null),
    setJson: vi.fn(async () => undefined),
  },
}));

vi.mock('../../src/lib/db/prisma', () => ({
  prisma: {
    unifiedSnapshotDaily: {
      findMany: vi.fn(async () => []),
    },
    unifiedCampaign: {
      count: vi.fn(async () => 0),
    },
    connectedAccount: {
      count: vi.fn(async () => 0),
    },
  },
}));

describe('GET /api/unified/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success payload', async () => {
    const route = await import('../../src/app/api/unified/overview/route');
    const response = await route.GET(new Request('https://example.com/api/unified/overview'));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toBeTruthy();
  });
});
