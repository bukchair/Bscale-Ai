import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { resolveEffectiveOwnerUserId, getRequestedOwnerUid } from '@/src/lib/auth/workspace';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const effectiveUserId = await resolveEffectiveOwnerUserId(
      user.id,
      getRequestedOwnerUid(request, user.id)
    );
    const connections = await integrationOrchestrator.listConnections(effectiveUserId);
    return ok('Connections loaded successfully.', { connections });
  } catch (error) {
    return toErrorResponse(error, 'Failed to load connections.');
  }
}
