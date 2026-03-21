import { prisma } from '@/src/lib/db/prisma';
import { providerFactory } from '@/src/lib/integrations/core/provider-factory';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import type { Platform } from '@/src/lib/integrations/core/types';
import type { RefreshTokensPayload } from '@/src/lib/sync/queue/payloads';

export const processRefreshTokens = async (payload: RefreshTokensPayload) => {
  const threshold = new Date(Date.now() + 10 * 60 * 1000);
  const where =
    payload.scope === 'connection' && payload.connectionId
      ? { id: payload.connectionId }
      : {
          OR: [{ tokenExpiresAt: { lte: threshold } }, { tokenExpiresAt: null }],
        };

  const connections = await prisma.platformConnection.findMany({
    where: {
      ...where,
      encryptedRefreshToken: { not: null },
      status: { in: ['CONNECTED', 'EXPIRED', 'ERROR'] },
    },
    select: {
      id: true,
      userId: true,
      platform: true,
      encryptedRefreshToken: true,
    },
  });

  console.info(`[refresh-tokens] Starting token refresh. scope=${payload.scope} total=${connections.length}`);

  let refreshed = 0;
  let failed = 0;
  for (const connection of connections) {
    try {
      const provider = providerFactory.get(connection.platform as Platform);
      const tokenSet = await provider.refreshToken({
        connectionId: connection.id,
        userId: connection.userId,
        encryptedRefreshToken: connection.encryptedRefreshToken,
      });
      await tokenService.saveTokenSet(connection.userId, connection.id, tokenSet);
      refreshed += 1;
      console.info(`[refresh-tokens] OK  platform=${connection.platform} connectionId=${connection.id}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Token refresh failed.';
      console.error(`[refresh-tokens] FAIL platform=${connection.platform} connectionId=${connection.id} error=${message}`);
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          status: 'EXPIRED',
          lastError: message,
        },
      });
      await prisma.syncErrorLog.create({
        data: {
          userId: connection.userId,
          platform: connection.platform,
          connectionId: connection.id,
          category: 'TOKEN_REFRESH',
          message,
        },
      });
    }
  }

  console.info(`[refresh-tokens] Done. refreshed=${refreshed} failed=${failed} total=${connections.length}`);
  return { refreshed, failed, total: connections.length };
};
