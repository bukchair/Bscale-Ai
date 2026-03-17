import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests that every cron route rejects requests without a valid CRON_SECRET.
 * We import each route module directly and call its POST handler.
 */

// Set the CRON_SECRET before importing routes (env is read at call-time via syncEnv).
const TEST_SECRET = 'super-secret-cron-key';
vi.stubEnv('CRON_SECRET', TEST_SECRET);

// Prisma mock — cron routes query the DB for connections/users.
vi.mock('@/src/lib/db/prisma', () => ({
  prisma: {
    platformConnection: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// BullMQ enqueue mock — we don't need a real Redis connection in tests.
vi.mock('@/src/lib/sync/queue/enqueue', () => ({
  enqueueSyncJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
}));

const makeRequest = (authHeader?: string) =>
  new Request('http://localhost/api/cron/test', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  });

describe('Cron routes — auth guard', () => {
  afterEach(() => vi.clearAllMocks());

  describe('POST /api/cron/refresh-tokens', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const { POST } = await import('../../src/app/api/cron/refresh-tokens/route');
      const res = await POST(makeRequest());
      expect(res.status).toBe(401);
    });

    it('returns 401 when secret is wrong', async () => {
      const { POST } = await import('../../src/app/api/cron/refresh-tokens/route');
      const res = await POST(makeRequest('Bearer wrong-secret'));
      expect(res.status).toBe(401);
    });

    it('returns 202 with correct secret', async () => {
      const { POST } = await import('../../src/app/api/cron/refresh-tokens/route');
      const res = await POST(makeRequest(`Bearer ${TEST_SECRET}`));
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.queued).toBe(true);
    });
  });

  describe('POST /api/cron/sync-all', () => {
    it('returns 401 without auth', async () => {
      const { POST } = await import('../../src/app/api/cron/sync-all/route');
      const res = await POST(makeRequest());
      expect(res.status).toBe(401);
    });

    it('returns 202 with correct secret and no active connections', async () => {
      const { POST } = await import('../../src/app/api/cron/sync-all/route');
      const res = await POST(makeRequest(`Bearer ${TEST_SECRET}`));
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.queued).toBe(true);
      expect(body.connections).toBe(0);
    });
  });

  describe('POST /api/cron/snapshot-daily', () => {
    it('returns 401 without auth', async () => {
      const { POST } = await import('../../src/app/api/cron/snapshot-daily/route');
      const res = await POST(makeRequest());
      expect(res.status).toBe(401);
    });

    it('returns 202 with correct secret', async () => {
      const { POST } = await import('../../src/app/api/cron/snapshot-daily/route');
      const res = await POST(makeRequest(`Bearer ${TEST_SECRET}`));
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.queued).toBe(true);
    });
  });
});
