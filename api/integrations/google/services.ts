import type { IncomingMessage, ServerResponse } from 'http';
import {
  listGoogleServiceConnections,
  resolveUserIdFromRequest,
  toPublicGoogleServicePayload,
} from '../_lib/google-store';

export default function handler(
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

  const items = listGoogleServiceConnections(userId).map(toPublicGoogleServicePayload);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ items }));
}
