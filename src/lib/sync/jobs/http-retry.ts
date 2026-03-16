type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value: string | null): number | null => {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) return asNumber * 1000;
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
};

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

const isRetryableBody = (body: any): boolean => {
  const text = JSON.stringify(body || {}).toLowerCase();
  return (
    text.includes('deadline_exceeded') ||
    text.includes('unavailable') ||
    text.includes('internal') ||
    text.includes('aborted') ||
    text.includes('"code":613') ||
    text.includes('rate limit')
  );
};

export const fetchWithRetry = async (
  input: string | URL | Request,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> => {
  const retries = options.retries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 1500;
  const maxDelayMs = options.maxDelayMs ?? 60_000;
  const jitterRatio = options.jitterRatio ?? 0.2;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok) return response;

      const cloned = response.clone();
      const body = await cloned.json().catch(() => null);
      const retryable = isRetryableStatus(response.status) || isRetryableBody(body);
      if (!retryable || attempt === retries) return response;

      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const expBackoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = expBackoff * Math.random() * jitterRatio;
      await sleep(Math.max(retryAfterMs ?? 0, expBackoff + jitter));
      continue;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const expBackoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = expBackoff * Math.random() * jitterRatio;
      await sleep(expBackoff + jitter);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('HTTP request failed after retries');
};
