import type { IncomingMessage, ServerResponse } from 'http';
import { disconnectServiceConnection, resolveUserIdFromRequest } from '../_lib/google-store';

export default function handler(
  req: IncomingMessage & { query?: any; headers?: any; body?: any },
  res: ServerResponse
) {
  if (req.method !== 'POST') {
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

  disconnectServiceConnection({ userId, serviceSlug: 'google-ads' });
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ disconnected: true, service: 'google_ads' }));
}
