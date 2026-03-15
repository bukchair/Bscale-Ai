import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { parsePlatformParam } from '@/src/lib/integrations/utils/platform-utils';
import { fail, ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';
import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ platform: string }>;
};

const runDisconnectFlow = async (context: RouteContext) => {
  try {
    const user = await requireAuthenticatedUser();
    const { platform: platformParam } = await context.params;
    const platform = parsePlatformParam(platformParam);
    await integrationOrchestrator.disconnect(user.id, platform);
    return ok('Platform disconnected successfully.', { disconnected: true });
  } catch (error) {
    if (error instanceof Error && error.message) {
      return fail('INTERNAL_ERROR', error.message, 500);
    }
    return toErrorResponse(error, 'Failed to disconnect platform.');
  }
};

export async function POST(_request: Request, context: RouteContext) {
  return runDisconnectFlow(context);
}

export async function GET(_request: Request, context: RouteContext) {
  return runDisconnectFlow(context);
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      allow: 'GET, POST, OPTIONS',
    },
  });
}
