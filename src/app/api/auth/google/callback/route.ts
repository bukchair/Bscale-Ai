import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { issueSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/src/lib/auth/session';

const STATE_COOKIE = 'google_auth_state';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

type GoogleUserInfo = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

export async function GET(request: Request) {
  const appBase = integrationsEnv.APP_BASE_URL;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${appBase}/auth?error=google_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appBase}/auth?error=invalid_callback`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${appBase}/auth?error=state_mismatch`);
  }

  // Exchange code for tokens
  let accessToken: string;
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: integrationsEnv.GOOGLE_AUTH_CLIENT_ID,
        client_secret: integrationsEnv.GOOGLE_AUTH_CLIENT_SECRET,
        redirect_uri: integrationsEnv.GOOGLE_AUTH_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[auth/google/callback] token exchange failed', await tokenRes.text());
      return NextResponse.redirect(`${appBase}/auth?error=token_exchange`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appBase}/auth?error=no_access_token`);
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error('[auth/google/callback] token exchange error', err);
    return NextResponse.redirect(`${appBase}/auth?error=token_exchange`);
  }

  // Fetch user info
  let userInfo: GoogleUserInfo;
  try {
    const userRes = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${appBase}/auth?error=userinfo_fetch`);
    }

    userInfo = (await userRes.json()) as GoogleUserInfo;
  } catch (err) {
    console.error('[auth/google/callback] userinfo error', err);
    return NextResponse.redirect(`${appBase}/auth?error=userinfo_fetch`);
  }

  if (!userInfo.email || !userInfo.sub) {
    return NextResponse.redirect(`${appBase}/auth?error=missing_claims`);
  }

  // Issue session
  const sessionToken = await issueSessionToken({
    id: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name ?? null,
  });

  const response = NextResponse.redirect(`${appBase}/app`);

  // Clear state cookie
  response.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' });

  // Set session cookie
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
