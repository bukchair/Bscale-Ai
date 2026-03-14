import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const HISTORY_CHANGE_EVENT = 'gtm-history-change';

const isValidGtmId = (value: string) => /^GTM-[A-Z0-9]+$/i.test(value);

export function GoogleTagManager() {
  const gtmId = (import.meta.env.VITE_GTM_ID || '').trim();

  useEffect(() => {
    if (!gtmId || !isValidGtmId(gtmId)) {
      if (import.meta.env.DEV) {
        console.warn('Google Tag Manager is disabled. Set a valid VITE_GTM_ID (e.g. GTM-XXXXXXX).');
      }
      return;
    }

    window.dataLayer = window.dataLayer || [];
    const startedAlready = window.dataLayer.some((entry) => entry.event === 'gtm.js');
    if (!startedAlready) {
      window.dataLayer.push({
        'gtm.start': Date.now(),
        event: 'gtm.js',
      });
    }

    const scriptId = `gtm-script-${gtmId}`;
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
      document.head.appendChild(script);
    }

    const pushPageView = () => {
      window.dataLayer?.push({
        event: 'page_view',
        page_path: window.location.pathname + window.location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    };

    pushPageView();

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function pushState(...args) {
      const result = originalPushState(...args);
      window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT));
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState(...args);
      window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT));
      return result;
    };

    const handleRouteChange = () => pushPageView();
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener(HISTORY_CHANGE_EVENT, handleRouteChange);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener(HISTORY_CHANGE_EVENT, handleRouteChange);
    };
  }, [gtmId]);

  return null;
}
