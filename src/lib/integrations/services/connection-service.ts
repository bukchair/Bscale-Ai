import { prisma } from '@/src/lib/db/prisma';
import type { Platform } from '@/src/lib/integrations/core/types';
import { IntegrationError } from '@/src/lib/integrations/core/errors';

export const connectionService = {
  async listForUser(userId: string) {
    return prisma.platformConnection.findMany({
      where: { userId },
      include: {
        connectedAccounts: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ platform: 'asc' }, { updatedAt: 'desc' }],
    });
  },

  async getByUserPlatform(userId: string, platform: Platform) {
    return prisma.platformConnection.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
      include: {
        connectedAccounts: true,
      },
    });
  },

  async ensurePendingConnection(userId: string, platform: Platform) {
    return prisma.platformConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
      create: {
        userId,
        platform,
        status: 'PENDING',
      },
      update: {
        status: 'PENDING',
        lastError: null,
      },
    });
  },

  async saveDiscoveredAccounts(
    userId: string,
    connectionId: string,
    platform: Platform,
    accounts: Array<{
      externalAccountId: string;
      externalParentId?: string | null;
      name: string;
      currency?: string | null;
      timezone?: string | null;
      status?: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<void> {
    const existing = await prisma.connectedAccount.findMany({
      where: { platformConnectionId: connectionId },
      select: { id: true, externalAccountId: true },
    });

    const existingMap = new Map(existing.map((row) => [row.externalAccountId, row.id]));
    const incomingIds = new Set(accounts.map((account) => account.externalAccountId));

    await prisma.$transaction(async (tx) => {
      for (const account of accounts) {
        const existingId = existingMap.get(account.externalAccountId);
        if (existingId) {
          await tx.connectedAccount.update({
            where: { id: existingId },
            data: {
              name: account.name,
              currency: account.currency,
              timezone: account.timezone,
              status: account.status === 'disabled' ? 'DISABLED' : 'ACTIVE',
              metadata: account.metadata ? toPrismaJson(account.metadata) : undefined,
            },
          });
        } else {
          await tx.connectedAccount.create({
            data: {
              userId,
              platformConnectionId: connectionId,
              platform,
              externalAccountId: account.externalAccountId,
              externalParentId: account.externalParentId,
              name: account.name,
              currency: account.currency,
              timezone: account.timezone,
              status: account.status === 'disabled' ? 'DISABLED' : 'ACTIVE',
              metadata: account.metadata ? toPrismaJson(account.metadata) : undefined,
            },
          });
        }
      }

      const staleIds = existing
        .filter((row) => !incomingIds.has(row.externalAccountId))
        .map((row) => row.id);

      if (staleIds.length > 0) {
        await tx.connectedAccount.updateMany({
          where: { id: { in: staleIds } },
          data: { status: 'ARCHIVED', isSelected: false },
        });
      }
    });
  },

  async setSelectedAccounts(userId: string, connectionId: string, accountIds: string[]): Promise<void> {
    const records = await prisma.connectedAccount.findMany({
      where: { platformConnectionId: connectionId, userId },
      select: { id: true, externalAccountId: true },
    });

    if (!records.length) {
      throw new IntegrationError('NO_ACCOUNTS', 'No accounts available to select.', 404);
    }

    const validExternalIds = new Set(records.map((record) => record.externalAccountId));
    const invalidIds = accountIds.filter((id) => !validExternalIds.has(id));
    if (invalidIds.length > 0) {
      throw new IntegrationError('BAD_REQUEST', 'Some account IDs are invalid for this connection.', 400, {
        invalidIds,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.connectedAccount.updateMany({
        where: { platformConnectionId: connectionId, userId },
        data: { isSelected: false },
      });

      if (accountIds.length > 0) {
        await tx.connectedAccount.updateMany({
          where: {
            platformConnectionId: connectionId,
            userId,
            externalAccountId: { in: accountIds },
          },
          data: { isSelected: true },
        });
      }
    });
  },

  async disconnect(userId: string, platform: Platform): Promise<void> {
    const connection = await this.getByUserPlatform(userId, platform);
    if (!connection) {
      await prisma.oAuthState.deleteMany({
        where: { userId, platform },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.oAuthState.deleteMany({
        where: { userId, platform },
      });
      await tx.connectedAccount.deleteMany({
        where: { platformConnectionId: connection.id },
      });
      await tx.platformConnection.update({
        where: { id: connection.id },
        data: {
          status: 'DISCONNECTED',
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          scopes: null,
          tokenType: null,
          externalUserId: null,
          externalBusinessId: null,
          metadata: null,
          lastSyncAt: null,
          lastError: null,
        },
      });
    });
  },
};
