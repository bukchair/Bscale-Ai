import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { resolveEffectiveUserId } from '@/src/lib/auth/resolve-effective-user';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const effectiveUserId = await resolveEffectiveUserId(user);
    const connections = await integrationOrchestrator.listConnections(effectiveUserId);
    return ok('Connections loaded successfully.', { connections });
  } catch (error) {
    return toErrorResponse(error, 'Failed to load connections.');
  }
}
