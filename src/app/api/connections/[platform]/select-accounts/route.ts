import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { parsePlatformParam } from '@/src/lib/integrations/utils/platform-utils';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';
import { selectAccountsSchema } from '@/src/lib/integrations/core/dtos';

type RouteContext = {
  params: Promise<{ platform: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { platform: platformParam } = await context.params;
    const platform = parsePlatformParam(platformParam);
    const payload = selectAccountsSchema.parse(await request.json());
    await integrationOrchestrator.selectAccounts(user.id, platform, payload.accountIds);
    return ok('Selected accounts were updated.', { selectedAccountIds: payload.accountIds });
  } catch (error) {
    return toErrorResponse(error, 'Failed to update selected accounts.');
  }
}
