import { providerFactory } from '@/src/lib/integrations/core/provider-factory';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import type { SyncAccountsPayload } from '@/src/lib/sync/queue/payloads';

export const processSyncAccounts = async (payload: SyncAccountsPayload) => {
  const provider = providerFactory.get(payload.platform as any);
  const discovered = await provider.discoverAccounts(payload.connectionId, payload.userId);
  await connectionService.saveDiscoveredAccounts(
    payload.userId,
    payload.connectionId,
    payload.platform as any,
    discovered
  );
  return {
    discoveredCount: discovered.length,
  };
};
