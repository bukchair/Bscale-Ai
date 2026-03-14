import { ExternalApiError } from '@/src/lib/integrations/core/errors';

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

export const fetchJson = async <TResponse>(
  url: string,
  options: FetchOptions = {}
): Promise<TResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(options.headers ?? {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const textBody = await response.text();
    const parsed = textBody ? safeJsonParse(textBody) : undefined;

    if (!response.ok) {
      throw new ExternalApiError(`HTTP ${response.status} for ${url}`, {
        status: response.status,
        responseBody: parsed ?? textBody.slice(0, 400),
      });
    }

    return parsed as TResponse;
  } catch (error) {
    if (error instanceof ExternalApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExternalApiError(`Request timeout for ${url}`);
    }

    throw new ExternalApiError(`Network error for ${url}`, {
      originalMessage: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};
