import { describe, expect, it } from 'vitest';
import { fetchWithRetry } from '../../src/lib/sync/jobs/http-retry';

describe('fetchWithRetry', () => {
  it('returns response when request succeeds', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch;
    const response = await fetchWithRetry('https://example.com', undefined, {
      retries: 0,
      baseDelayMs: 1,
      maxDelayMs: 1,
      jitterRatio: 0,
    });
    globalThis.fetch = originalFetch;
    expect(response.status).toBe(200);
  });
});
