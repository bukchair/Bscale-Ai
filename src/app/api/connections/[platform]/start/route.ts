import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { parsePlatformParam } from '@/src/lib/integrations/utils/platform-utils';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';
import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ platform: string }>;
};

const runStartFlow = async (context: RouteContext) => {
  try {
    const user = await requireAuthenticatedUser();
    const { platform: platformParam } = await context.params;
    const platform = parsePlatformParam(platformParam);
    const data = await integrationOrchestrator.startConnection(user.id, platform);
    return ok('Connection flow started.', data);
  } catch (error) {
    return toErrorResponse(error, 'Failed to start connection flow.');
  }
};

export async function POST(_request: Request, context: RouteContext) {
  return runStartFlow(context);
}

// GET fallback prevents hard failures behind proxies/domain redirects that rewrite methods.
export async function GET(_request: Request, context: RouteContext) {
  return runStartFlow(context);
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      allow: 'GET, POST, OPTIONS',
    },
  });
}
