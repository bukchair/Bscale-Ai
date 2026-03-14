import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { parsePlatformParam, toRoutePlatform } from '@/src/lib/integrations/utils/platform-utils';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { toErrorResponse } from '@/src/lib/integrations/utils/api-response';

type RouteContext = {
  params: Promise<{ platform: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { platform: platformParam } = await context.params;
    const platform = parsePlatformParam(platformParam);
    const url = new URL(request.url);

    const result = await integrationOrchestrator.handleCallback(user.id, platform, {
      state: url.searchParams.get('state'),
      code: url.searchParams.get('code'),
      error: url.searchParams.get('error'),
      error_description: url.searchParams.get('error_description'),
    });

    const redirect = new URL('/connections', integrationsEnv.APP_BASE_URL);
    redirect.searchParams.set('platform', toRoutePlatform(platform));
    redirect.searchParams.set('status', result.status.toLowerCase());
    redirect.searchParams.set('connected', '1');
    return NextResponse.redirect(redirect);
  } catch (error) {
    if (error instanceof Error) {
      const redirect = new URL('/connections', integrationsEnv.APP_BASE_URL);
      redirect.searchParams.set('connected', '0');
      redirect.searchParams.set('error', error.message);
      return NextResponse.redirect(redirect);
    }
    return toErrorResponse(error, 'Failed to process callback.');
  }
}
