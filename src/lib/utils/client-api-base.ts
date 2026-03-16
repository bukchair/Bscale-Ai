const viteEnv =
  typeof import.meta !== 'undefined'
    ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ?? undefined)
    : undefined;

const configuredApiBase =
  (typeof viteEnv?.VITE_APP_URL === 'string' && viteEnv.VITE_APP_URL.trim()) || '';

export const API_BASE = (() => {
  if (!configuredApiBase || typeof window === 'undefined') return '';
  try {
    const configuredOrigin = new URL(configuredApiBase, window.location.origin).origin;
    return configuredOrigin === window.location.origin ? configuredOrigin : '';
  } catch {
    return '';
  }
})();
