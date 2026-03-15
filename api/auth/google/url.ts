import type { IncomingMessage, ServerResponse } from 'http';
import { URLSearchParams } from 'url';

export default function handler(req: IncomingMessage & { query?: any; headers: any }, res: ServerResponse & { json?: (body: any) => void }) {
  const json = (body: any) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  const error = (status: number, message: string) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message }));
  };

  if (req.method !== 'GET') {
    return error(405, 'Method not allowed');
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const fallbackRedirect = `${proto}://${host}/api/auth/google/callback`;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || fallbackRedirect;

  const scopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  if (!process.env.GOOGLE_CLIENT_ID) {
    return error(500, 'Google Client ID not configured');
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return json({ url });
}

