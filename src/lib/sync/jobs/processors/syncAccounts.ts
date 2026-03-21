import { providerFactory } from '@/src/lib/integrations/core/provider-factory';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import type { Platform } from '@/src/lib/integrations/core/types';
import type { SyncAccountsPayload } from '@/src/lib/sync/queue/payloads';

export const processSyncAccounts = async (payload: SyncAccountsPayload) => {
  const platform = payload.platform as Platform;
  const provider = providerFactory.get(platform);
  const discovered = await provider.discoverAccounts(payload.connectionId, payload.userId);
  await connectionService.saveDiscoveredAccounts(
    payload.userId,
    payload.connectionId,
    platform,
    discovered
  );
  return {
    discoveredCount: discovered.length,
  };
};
