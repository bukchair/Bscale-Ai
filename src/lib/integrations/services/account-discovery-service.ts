import type { IntegrationProvider } from '@/src/lib/integrations/core/interfaces';
import { connectionService } from '@/src/lib/integrations/services/connection-service';

export const accountDiscoveryService = {
  async run(userId: string, connectionId: string, provider: IntegrationProvider) {
    const discovered = await provider.discoverAccounts(connectionId, userId);
    await connectionService.saveDiscoveredAccounts(userId, connectionId, provider.platform, discovered);
    return discovered;
  },
};
