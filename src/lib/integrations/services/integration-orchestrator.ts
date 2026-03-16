import { prisma } from '@/src/lib/db/prisma';
import type { Platform } from '@/src/lib/integrations/core/types';
import { providerFactory } from '@/src/lib/integrations/core/provider-factory';
import { auditService } from '@/src/lib/integrations/services/audit-service';
import { rateLimitService } from '@/src/lib/integrations/services/rate-limit-service';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { accountDiscoveryService } from '@/src/lib/integrations/services/account-discovery-service';
import { syncService } from '@/src/lib/integrations/services/sync-service';
import { IntegrationError, OAuthStateMismatchError } from '@/src/lib/integrations/core/errors';

export const integrationOrchestrator = {
  async listConnections(userId: string) {
    const connections = await connectionService.listForUser(userId);
    if (connections.length === 0) return [];

    const connectionIds = connections.map((c) => c.id);

    // Batch-fetch the last 5 sync runs for all connections in a single query (avoids N+1).
    const allRuns = await prisma.syncRun.findMany({
      where: { syncJob: { connectionId: { in: connectionIds } } },
      include: {
        syncJob: {
          select: { id: true, platform: true, type: true, requestedBy: true, connectionId: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Group runs by connectionId and keep at most 5 per connection.
    const runsByConnection = new Map<string, typeof allRuns>();
    for (const run of allRuns) {
      const cid = run.syncJob.connectionId;
      if (!runsByConnection.has(cid)) runsByConnection.set(cid, []);
      const bucket = runsByConnection.get(cid)!;
      if (bucket.length < 5) bucket.push(run);
    }

    return connections.map((connection) => {
      const history = runsByConnection.get(connection.id) ?? [];
      return {
        id: connection.id,
        platform: connection.platform,
        status: connection.status,
        lastSyncAt: connection.lastSyncAt,
        lastError: connection.lastError,
        updatedAt: connection.updatedAt,
        connectedAccountCount: connection.connectedAccounts.length,
        selectedAccountCount: connection.connectedAccounts.filter((account) => account.isSelected).length,
        accounts: connection.connectedAccounts.map((account) => ({
          id: account.id,
          externalAccountId: account.externalAccountId,
          name: account.name,
          status: account.status,
          isSelected: account.isSelected,
          currency: account.currency,
          timezone: account.timezone,
          metadata: account.metadata,
        })),
        history: history.map((run) => ({
          id: run.id,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          errorMessage: run.errorMessage,
          resultSummary: run.resultSummary,
          jobType: run.syncJob.type,
        })),
      };
    });
  },

  async startConnection(userId: string, platform: Platform) {
    await rateLimitService.enforce({
      userId,
      key: `connect_start:${platform}`,
      limit: 15,
      windowSeconds: 60,
    });

    const provider = providerFactory.get(platform);
    await connectionService.ensurePendingConnection(userId, platform);

    await auditService.log({
      userId,
      action: 'connect_initiated',
      platform,
    });

    const authorizationUrl = await provider.getAuthorizationUrl({ userId });
    return { authorizationUrl };
  },

  async handleCallback(userId: string, platform: Platform, query: Record<string, string | null>) {
    const provider = providerFactory.get(platform);

    try {
      const result = await provider.handleCallback(
        { userId },
        {
          state: query.state || '',
          code: query.code || null,
          error: query.error || null,
          errorDescription: query.error_description || null,
        }
      );

      let autoImportedAccounts = 0;
      if (result.connectionId && provider.supports('ACCOUNT_DISCOVERY')) {
        try {
          const discovered = await accountDiscoveryService.run(userId, result.connectionId, provider);
          if (discovered.length > 0) {
            await connectionService.setSelectedAccounts(
              userId,
              result.connectionId,
              discovered.map((account) => account.externalAccountId)
            );
            autoImportedAccounts = discovered.length;
          }
        } catch (autoImportError) {
          await auditService.log({
            userId,
            action: 'accounts_auto_import_failed',
            platform,
            connectionId: result.connectionId,
            details: {
              message:
                autoImportError instanceof Error ? autoImportError.message : String(autoImportError),
            },
          });
        }
      }

      await auditService.log({
        userId,
        action: 'connect_success',
        platform,
        connectionId: result.connectionId,
        details: {
          autoImportedAccounts,
        },
      });

      return result;
    } catch (error) {
      if (error instanceof OAuthStateMismatchError) {
        const existing = await connectionService.getByUserPlatform(userId, platform);
        if (existing?.status === 'CONNECTED') {
          return { connectionId: existing.id, status: existing.status };
        }
      }

      await auditService.log({
        userId,
        action: 'connect_failed',
        platform,
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  },

  async discoverAccounts(userId: string, platform: Platform) {
    await rateLimitService.enforce({
      userId,
      key: `accounts:${platform}`,
      limit: 30,
      windowSeconds: 60,
    });

    const connection = await connectionService.getByUserPlatform(userId, platform);
    if (!connection) {
      throw new IntegrationError('NOT_FOUND', 'Connection not found for this platform.', 404);
    }

    const provider = providerFactory.get(platform);
    const accounts = await accountDiscoveryService.run(userId, connection.id, provider);

    await auditService.log({
      userId,
      action: 'accounts_discovered',
      platform,
      connectionId: connection.id,
      details: { count: accounts.length },
    });

    return accounts;
  },

  async selectAccounts(userId: string, platform: Platform, accountIds: string[]) {
    const connection = await connectionService.getByUserPlatform(userId, platform);
    if (!connection) {
      throw new IntegrationError('NOT_FOUND', 'Connection not found for this platform.', 404);
    }
    await connectionService.setSelectedAccounts(userId, connection.id, accountIds);
    await auditService.log({
      userId,
      action: 'account_selection_changed',
      platform,
      connectionId: connection.id,
      details: { accountIds },
    });
  },

  async testConnection(userId: string, platform: Platform, accountId?: string) {
    await rateLimitService.enforce({
      userId,
      key: `test:${platform}`,
      limit: 20,
      windowSeconds: 60,
    });

    const connection = await connectionService.getByUserPlatform(userId, platform);
    if (!connection) {
      throw new IntegrationError('NOT_FOUND', 'Connection not found for this platform.', 404);
    }

    const provider = providerFactory.get(platform);
    const { job, run } = await syncService.startJob({
      userId,
      platform,
      connectionId: connection.id,
      type: 'TEST',
      requestedBy: userId,
    });

    try {
      const result = await provider.testConnection(connection.id, accountId);
      await syncService.finishRun({
        syncRunId: run.id,
        status: 'SUCCESS',
        resultSummary: result.summary,
      });
      return { jobId: job.id, runId: run.id, result };
    } catch (error) {
      await syncService.finishRun({
        syncRunId: run.id,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async syncNow(userId: string, platform: Platform, accountId?: string, forceRefresh = false) {
    await rateLimitService.enforce({
      userId,
      key: `sync:${platform}`,
      limit: 10,
      windowSeconds: 60,
    });

    const connection = await connectionService.getByUserPlatform(userId, platform);
    if (!connection) {
      throw new IntegrationError('NOT_FOUND', 'Connection not found for this platform.', 404);
    }

    const provider = providerFactory.get(platform);
    const { job, run } = await syncService.startJob({
      userId,
      platform,
      connectionId: connection.id,
      type: forceRefresh ? 'REFRESH' : 'MANUAL_SYNC',
      requestedBy: userId,
    });

    try {
      const accounts = await accountDiscoveryService.run(userId, connection.id, provider);
      const testResult = await provider.testConnection(connection.id, accountId);
      await syncService.finishRun({
        syncRunId: run.id,
        status: 'SUCCESS',
        resultSummary: {
          discoveredAccounts: accounts.length,
          testSummary: testResult.summary ?? null,
        },
      });

      await auditService.log({
        userId,
        action: 'manual_sync',
        platform,
        connectionId: connection.id,
        details: {
          discoveredAccounts: accounts.length,
          forceRefresh,
        },
      });

      return { jobId: job.id, runId: run.id, discoveredAccounts: accounts.length, testResult };
    } catch (error) {
      await syncService.finishRun({
        syncRunId: run.id,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      await auditService.log({
        userId,
        action: 'manual_sync_failed',
        platform,
        connectionId: connection.id,
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  },

  async disconnect(userId: string, platform: Platform) {
    await rateLimitService.enforce({
      userId,
      key: `disconnect:${platform}`,
      limit: 10,
      windowSeconds: 60,
    });

    const connection = await connectionService.getByUserPlatform(userId, platform);
    if (!connection) return;
    const provider = providerFactory.get(platform);
    await provider.disconnect(connection.id);
    await auditService.log({
      userId,
      action: 'disconnect',
      platform,
      connectionId: connection.id,
    });
  },

  async loadConnectionById(userId: string, connectionId: string) {
    return prisma.platformConnection.findFirst({
      where: { userId, id: connectionId },
      include: { connectedAccounts: true },
    });
  },
};
