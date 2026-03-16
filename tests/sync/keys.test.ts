import { describe, expect, it } from 'vitest';
import { cacheKeys } from '../../src/lib/sync/cache/keys';

describe('cache keys', () => {
  it('builds overview key with stable prefix', () => {
    const key = cacheKeys.unifiedOverview('u1', '2026-03-01', '2026-03-16');
    expect(key).toContain('bscale:v1:overview:u1:2026-03-01:2026-03-16');
  });

  it('builds campaigns key with filters', () => {
    const key = cacheKeys.unifiedCampaigns('u1', 'Google', 'acc1', 'start', 50, 'qhash');
    expect(key).toContain('bscale:v1:campaigns:u1:Google:acc1:start:50:qhash');
  });
});
