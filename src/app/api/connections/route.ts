import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const connections = await integrationOrchestrator.listConnections(user.id);
    return ok('Connections loaded successfully.', { connections });
  } catch (error) {
    return toErrorResponse(error, 'Failed to load connections.');
  }
}
