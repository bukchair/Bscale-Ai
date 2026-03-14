import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { parsePlatformParam } from '@/src/lib/integrations/utils/platform-utils';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';
import { testConnectionSchema } from '@/src/lib/integrations/core/dtos';

type RouteContext = {
  params: Promise<{ platform: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { platform: platformParam } = await context.params;
    const platform = parsePlatformParam(platformParam);
    const payload = testConnectionSchema.parse(await request.json().catch(() => ({})));
    const result = await integrationOrchestrator.testConnection(user.id, platform, payload.accountId);
    return ok('Connection test completed.', result);
  } catch (error) {
    return toErrorResponse(error, 'Failed to test connection.');
  }
}
