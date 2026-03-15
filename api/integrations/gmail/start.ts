import type { IncomingMessage, ServerResponse } from 'http';
import {
  buildGoogleOAuthUrl,
  resolveUserIdFromRequest,
} from '../_lib/google-store';

export default function handler(
  req: IncomingMessage & { query?: any; headers?: any },
  res: ServerResponse
) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Method not allowed' }));
    return;
  }

  const userId = resolveUserIdFromRequest(req);
  if (!userId) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Missing user_id' }));
    return;
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Google OAuth client is not configured' }));
    return;
  }

  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const proto = (req.headers?.['x-forwarded-proto'] as string) || 'https';
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI || `${proto}://${host}/api/integrations/gmail/callback`;

  const selectAccount = String(req.query?.select_account || '') === '1';
  const { url } = buildGoogleOAuthUrl({
    serviceSlug: 'gmail',
    redirectUri,
    userId,
    selectAccount,
  });

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ url }));
}
