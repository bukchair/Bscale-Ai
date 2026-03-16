import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';

import { GOOGLE_ADS_API_BASE } from '@/src/lib/constants/api-urls';
import { toApiErrorMessage as toErrorMessage } from '@/src/lib/utils/api-request-utils';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
      user.id,
      'GOOGLE_ADS'
    );
    const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata);

    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const response = await fetch(`${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, {
      method: 'GET',
      headers,
    });
    const raw = await response.text();
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: toErrorMessage(response.status, raw, parsed) },
        { status: response.status }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Failed to load Google Ads accounts for this user.',
      },
      { status: 500 }
    );
  }
}
