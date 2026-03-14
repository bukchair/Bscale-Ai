import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/src/lib/db/prisma';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { IntegrationError } from '@/src/lib/integrations/core/errors';

const SESSION_COOKIE_NAME = 'saas_session';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
};

type SessionPayload = {
  sub: string;
  email: string;
  name?: string;
};

const getSessionSecret = () => new TextEncoder().encode(integrationsEnv.SESSION_SIGNING_SECRET);

export const requireAuthenticatedUser = async (): Promise<AuthenticatedUser> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    throw new IntegrationError('UNAUTHORIZED', 'Missing user session.', 401);
  }

  let payload: SessionPayload;
  try {
    const { payload: verifiedPayload } = await jwtVerify(rawToken, getSessionSecret(), {
      algorithms: ['HS256'],
    });
    payload = {
      sub: String(verifiedPayload.sub || ''),
      email: String(verifiedPayload.email || ''),
      name: verifiedPayload.name ? String(verifiedPayload.name) : undefined,
    };
  } catch {
    throw new IntegrationError('UNAUTHORIZED', 'Invalid user session.', 401);
  }

  if (!payload.sub || !payload.email) {
    throw new IntegrationError('UNAUTHORIZED', 'Session payload is missing user claims.', 401);
  }

  const user = await prisma.user.upsert({
    where: { id: payload.sub },
    update: { email: payload.email, name: payload.name ?? null },
    create: { id: payload.sub, email: payload.email, name: payload.name ?? null },
    select: { id: true, email: true, name: true },
  });

  return user;
};
