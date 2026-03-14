import { prisma } from '@/src/lib/db/prisma';
import { decryptSecret, encryptSecret } from '@/src/lib/crypto/token-encryption';
import type { ProviderTokenSet } from '@/src/lib/integrations/core/types';
import { TokenRefreshError } from '@/src/lib/integrations/core/errors';
import { auditService } from '@/src/lib/integrations/services/audit-service';
import { toPrismaJson } from '@/src/lib/integrations/utils/prisma-json';

export const tokenService = {
  async saveTokenSet(
    userId: string,
    connectionId: string,
    tokenSet: ProviderTokenSet
  ): Promise<void> {
    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        encryptedAccessToken: encryptSecret(tokenSet.accessToken),
        encryptedRefreshToken: tokenSet.refreshToken
          ? encryptSecret(tokenSet.refreshToken)
          : undefined,
        tokenExpiresAt: tokenSet.expiresAt,
        tokenType: tokenSet.tokenType,
        scopes: tokenSet.scopes ?? [],
        externalUserId: tokenSet.externalUserId,
        externalBusinessId: tokenSet.externalBusinessId,
        metadata: tokenSet.metadata ? toPrismaJson(tokenSet.metadata) : undefined,
        status: 'CONNECTED',
        lastError: null,
      },
    });

    await auditService.log({
      userId,
      action: 'refresh_success',
      connectionId,
      details: { tokenExpiresAt: tokenSet.expiresAt?.toISOString() ?? null },
    });
  },

  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { encryptedAccessToken: true },
    });

    if (!connection?.encryptedAccessToken) {
      throw new TokenRefreshError('Connection access token is missing.');
    }

    return decryptSecret(connection.encryptedAccessToken);
  },

  async getRefreshToken(connectionId: string): Promise<string> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { encryptedRefreshToken: true },
    });

    if (!connection?.encryptedRefreshToken) {
      throw new TokenRefreshError('Connection refresh token is missing.');
    }

    return decryptSecret(connection.encryptedRefreshToken);
  },
};
