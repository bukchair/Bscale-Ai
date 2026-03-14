declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export type TrackingPayload = Record<string, unknown>;

export function trackEvent(event: string, payload: TrackingPayload = {}) {
  if (typeof window === 'undefined') return;
  if (!event || typeof event !== 'string') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...payload,
  });
}
