import { prisma } from '@/src/lib/db/prisma';
import type { AuthenticatedUser } from './session';

/**
 * Returns the effective data-owner ID for the given authenticated user.
 *
 * If the user has an accepted UserWorkspaceAccess record (i.e. they were
 * invited into someone else's workspace and clicked "Accept"), their queries
 * should be scoped to the *owner's* data, not their own.
 *
 * Falls back to the user's own ID when no accepted grant exists.
 */
export async function resolveEffectiveUserId(sessionUser: AuthenticatedUser): Promise<string> {
  const access = await prisma.userWorkspaceAccess.findFirst({
    where: { guestUserId: sessionUser.id },
    select: { ownerUserId: true },
  });
  return access?.ownerUserId ?? sessionUser.id;
}
