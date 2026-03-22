import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers applied to every response.
 *
 * CSP is set in report-only mode initially so violations appear in the
 * browser console / Cloud Run logs without breaking the app. Once all
 * violations are resolved, switch `Content-Security-Policy-Report-Only`
 * to `Content-Security-Policy`.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // Report-only until all inline scripts/styles are reviewed.
  'Content-Security-Policy-Report-Only': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://graph.facebook.com https://business-api.tiktok.com https://googleads.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com wss:",
    "frame-ancestors 'none'",
  ].join('; '),
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

export const config = {
  // Apply to all routes except Next.js internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
