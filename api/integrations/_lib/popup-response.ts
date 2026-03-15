import type { ServerResponse } from 'http';

type PopupSuccessPayload = {
  platform: 'google-service';
  service: string;
  status: 'connected';
};

type PopupErrorPayload = {
  platform: 'google-service';
  service: string;
  error: string;
};

const renderPayload = (payload: PopupSuccessPayload | PopupErrorPayload, isError: boolean) => {
  const eventType = isError ? 'OAUTH_AUTH_ERROR' : 'OAUTH_AUTH_SUCCESS';
  return `
  <html>
    <body>
      <script>
        (function () {
          if (window.opener) {
            window.opener.postMessage({
              type: '${eventType}',
              ${isError ? '' : "status: 'connected',"}
              platform: 'google-service',
              service: '${payload.service}',
              ${isError ? `error: ${JSON.stringify((payload as PopupErrorPayload).error)}` : ''}
            }, '*');
          }
          window.close();
        })();
      </script>
    </body>
  </html>`;
};

export const sendPopupSuccess = (
  res: ServerResponse,
  payload: Omit<PopupSuccessPayload, 'platform' | 'status'>
) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderPayload({ ...payload, platform: 'google-service', status: 'connected' }, false));
};

export const sendPopupError = (
  res: ServerResponse,
  payload: Omit<PopupErrorPayload, 'platform'>
) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderPayload({ ...payload, platform: 'google-service' }, true));
};

// Prevent Vercel API route build errors if this helper file is scanned as a function.
export default function _libPopupResponseHandler(_req: unknown, res: { statusCode?: number; end: (body?: string) => void }) {
  res.statusCode = 404;
  res.end('Not Found');
}
