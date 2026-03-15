import type { IncomingMessage, ServerResponse } from 'http';
import {
  consumeOAuthState,
  exchangeCodeForServiceToken,
  saveServiceConnection,
} from '../_lib/google-store';
import { sendPopupError, sendPopupSuccess } from '../_lib/popup-response';

export default async function handler(
  req: IncomingMessage & { query?: any; headers?: any },
  res: ServerResponse
) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  const code = String(req.query?.code || '').trim();
  const state = String(req.query?.state || '').trim();
  if (!code || !state) {
    sendPopupError(res, {
      service: 'search_console',
      error: 'Missing OAuth callback code or state.',
    });
    return;
  }

  const consumed = consumeOAuthState(state, 'search-console');
  if (!consumed?.user_id) {
    sendPopupError(res, {
      service: 'search_console',
      error: 'Invalid or expired OAuth state.',
    });
    return;
  }

  try {
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
    const proto = (req.headers?.['x-forwarded-proto'] as string) || 'https';
    const redirectUri =
      process.env.SEARCH_CONSOLE_REDIRECT_URI ||
      `${proto}://${host}/api/integrations/search-console/callback`;

    const token = await exchangeCodeForServiceToken({ code, redirectUri });
    saveServiceConnection({
      userId: consumed.user_id,
      serviceSlug: 'search-console',
      token,
    });
    sendPopupSuccess(res, { service: 'search_console' });
  } catch (error: any) {
    sendPopupError(res, {
      service: 'search_console',
      error: error?.message || 'Failed to authenticate Search Console service.',
    });
  }
}
