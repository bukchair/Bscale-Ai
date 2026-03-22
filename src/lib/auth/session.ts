import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db/prisma';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { IntegrationError } from '@/src/lib/integrations/core/errors';
import { logWithUserContext } from '@/src/lib/logging/server-structured-log';

export const SESSION_COOKIE_NAME = 'saas_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

type SessionPayload = {
  sub: string;
  email: string;
  name?: string;
};

const getSessionSecret = () => new TextEncoder().encode(integrationsEnv.SESSION_SIGNING_SECRET);

export const issueSessionToken = async (user: Pick<AuthenticatedUser, 'id' | 'email' | 'name'>): Promise<string> => {
  return new SignJWT({
    email: user.email,
    name: user.name ?? undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret());
};

/** True when a Prisma error is caused by a missing column (migration not yet applied). */
function isMissingColumnError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2022' || err.code === 'P2021';
  }
  // Raw DB error message as fallback
  if (err instanceof Error) {
    return err.message.includes('column') && err.message.includes('does not exist');
  }
  return false;
}

async function findUser(id: string) {
  try {
    return await prisma.user.findFirst({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    // role column missing — migration pending; fall back to query without it
    const row = await prisma.user.findFirst({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    return row ? { ...row, role: 'user' as const } : null;
  }
}

async function createUser(id: string, email: string, name: string | null) {
  try {
    return await prisma.user.create({
      data: { id, email, name },
      select: { id: true, email: true, name: true, role: true },
    });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const row = await prisma.user.create({
      data: { id, email, name },
      select: { id: true, email: true, name: true },
    });
    return { ...row, role: 'user' as const };
  }
}

async function updateUser(id: string, email: string, name: string | null) {
  try {
    return await prisma.user.update({
      where: { id },
      data: { email, name },
      select: { id: true, email: true, name: true, role: true },
    });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const row = await prisma.user.update({
      where: { id },
      data: { email, name },
      select: { id: true, email: true, name: true },
    });
    return { ...row, role: 'user' as const };
  }
}

async function getRequestPath(): Promise<string> {
  try {
    const h = await headers();
    const nextUrl = h.get('next-url') || h.get('x-invoke-path') || '';
    if (!nextUrl) return 'unknown';
    return nextUrl.startsWith('http') ? new URL(nextUrl).pathname : nextUrl;
  } catch {
    return 'unknown';
  }
}

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
    const path = await getRequestPath();
    logWithUserContext('WARNING', 'Invalid session token', { path });
    throw new IntegrationError('UNAUTHORIZED', 'Invalid user session.', 401);
  }

  if (!payload.sub || !payload.email) {
    throw new IntegrationError('UNAUTHORIZED', 'Session payload is missing user claims.', 401);
  }

  let user = await findUser(payload.sub);

  if (!user) {
    user = await createUser(payload.sub, payload.email, payload.name ?? null);
  } else if (user.email !== payload.email || user.name !== (payload.name ?? null)) {
    user = await updateUser(payload.sub, payload.email, payload.name ?? null);
  }

  const path = await getRequestPath();
  logWithUserContext('INFO', `API ${path}`, {
    userEmail: user.email,
    userId: user.id,
    path,
  });

  return user;
};
