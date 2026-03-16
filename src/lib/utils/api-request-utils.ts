/**
 * Shared utilities for API route handlers.
 * Centralizes repeated patterns across Google Ads, GA4, GSC, Meta, and TikTok routes.
 */

/** Extract a human-readable error message from an API response. */
export const toApiErrorMessage = (status: number, raw: string, parsed: unknown): string => {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const rootError = obj.error;
    if (rootError && typeof rootError === 'object') {
      const msg = (rootError as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    const msg = obj.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (raw.trim()) return `Request failed (${status}): ${raw.slice(0, 240)}`;
  return `Request failed (${status}).`;
};

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Validate and normalize a YYYY-MM-DD date string; returns '' if invalid. */
export const normalizeDateParam = (value: string | null): string => {
  const trimmed = (value || '').trim();
  return DATE_PARAM_REGEX.test(trimmed) ? trimmed : '';
};

/** Strip all non-digit characters from a Google Ads customer ID. */
export const normalizeCustomerId = (value: string): string => value.replace(/\D/g, '');

/** Safe JSON parse — returns null on failure instead of throwing. */
export const safeJsonParse = (raw: string): unknown => {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
