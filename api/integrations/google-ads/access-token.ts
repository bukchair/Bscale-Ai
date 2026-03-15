import type { IncomingMessage, ServerResponse } from 'http';
import { getValidServiceAccessToken, resolveUserIdFromRequest } from '../_lib/google-store';

export default async function handler(
  req: IncomingMessage & { query?: any; headers?: any; body?: any },
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

  try {
    const accessToken = await getValidServiceAccessToken({ userId, service: 'google_ads' });
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ accessToken }));
  } catch (error: any) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: error?.message || 'Google Ads service is not connected.' }));
  }
}
