import { createHash, randomBytes } from 'node:crypto';
import { Platform } from '@/src/lib/integrations/core/types';
import { prisma } from '@/src/lib/db/prisma';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { decryptSecret, encryptSecret } from '@/src/lib/crypto/token-encryption';
import { OAuthStateMismatchError } from '@/src/lib/integrations/core/errors';

const base64Url = (buffer: Buffer) => buffer.toString('base64url');

const sha256 = (input: string) => createHash('sha256').update(input).digest('base64url');

export type IssuedOAuthState = {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
};

export const issueOAuthState = async (
  userId: string,
  platform: Platform,
  redirectPath?: string
): Promise<IssuedOAuthState> => {
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(48));
  const codeChallenge = sha256(codeVerifier);
  const stateHash = sha256(state);

  await prisma.oAuthState.create({
    data: {
      userId,
      platform,
      stateHash,
      codeVerifierEnc: encryptSecret(codeVerifier),
      status: 'ISSUED',
      redirectPath,
      expiresAt: new Date(Date.now() + integrationsEnv.OAUTH_STATE_TTL_SECONDS * 1000),
    },
  });

  return { state, codeVerifier, codeChallenge };
};

export const consumeOAuthState = async (
  userId: string,
  platform: Platform,
  state: string
): Promise<{ codeVerifier: string; redirectPath: string | null }> => {
  const stateHash = sha256(state);
  const existing = await prisma.oAuthState.findFirst({
    where: {
      userId,
      platform,
      stateHash,
      status: 'ISSUED',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) {
    throw new OAuthStateMismatchError();
  }

  await prisma.oAuthState.update({
    where: { id: existing.id },
    data: { status: 'CONSUMED', consumedAt: new Date() },
  });

  return {
    codeVerifier: decryptSecret(existing.codeVerifierEnc),
    redirectPath: existing.redirectPath,
  };
};

export const consumeOAuthStateWithoutUser = async (
  platform: Platform,
  state: string
): Promise<{ userId: string; codeVerifier: string; redirectPath: string | null }> => {
  const stateHash = sha256(state);
  const existing = await prisma.oAuthState.findFirst({
    where: {
      platform,
      stateHash,
      status: 'ISSUED',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) {
    throw new OAuthStateMismatchError();
  }

  await prisma.oAuthState.update({
    where: { id: existing.id },
    data: { status: 'CONSUMED', consumedAt: new Date() },
  });

  return {
    userId: existing.userId,
    codeVerifier: decryptSecret(existing.codeVerifierEnc),
    redirectPath: existing.redirectPath,
  };
};

export const expireStaleOAuthStates = async (): Promise<void> => {
  await prisma.oAuthState.updateMany({
    where: { status: 'ISSUED', expiresAt: { lte: new Date() } },
    data: { status: 'EXPIRED' },
  });
};
