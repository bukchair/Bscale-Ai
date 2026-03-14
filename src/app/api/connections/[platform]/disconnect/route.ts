import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { parsePlatformParam } from '@/src/lib/integrations/utils/platform-utils';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';

type RouteContext = {
  params: Promise<{ platform: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { platform: platformParam } = await context.params;
    const platform = parsePlatformParam(platformParam);
    await integrationOrchestrator.disconnect(user.id, platform);
    return ok('Platform disconnected successfully.', { disconnected: true });
  } catch (error) {
    return toErrorResponse(error, 'Failed to disconnect platform.');
  }
}
