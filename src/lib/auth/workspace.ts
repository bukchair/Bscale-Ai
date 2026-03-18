import { prisma } from '@/src/lib/db/prisma';
import { IntegrationError } from '@/src/lib/integrations/core/errors';

/**
 * Resolves the effective owner userId for a request.
 *
 * When User B has accepted shared access to User A's workspace, any API request
 * from User B carrying the `X-Owner-UID: <A_uid>` header will be scoped to
 * User A's data after this check passes.
 *
 * Returns the authenticatedUserId unchanged when:
 *  - no requestedOwnerUserId is provided
 *  - requestedOwnerUserId equals authenticatedUserId (own workspace)
 *
 * Throws an IntegrationError(403) when:
 *  - the SharedAccess record does not exist
 *  - the invitation has not been accepted yet
 */
export async function resolveEffectiveOwnerUserId(
  authenticatedUserId: string,
  requestedOwnerUserId?: string | null
): Promise<string> {
  if (!requestedOwnerUserId || requestedOwnerUserId === authenticatedUserId) {
    return authenticatedUserId;
  }

  const access = await prisma.sharedAccess.findFirst({
    where: {
      ownerUserId: requestedOwnerUserId,
      sharedUserId: authenticatedUserId,
      status: 'accepted',
    },
    select: { id: true },
  });

  if (!access) {
    throw new IntegrationError(
      'FORBIDDEN',
      'You do not have accepted shared access to this workspace.',
      403
    );
  }

  return requestedOwnerUserId;
}

/**
 * Reads the X-Owner-UID header from a request and returns it if present
 * and different from the authenticated user's own ID.
 */
export function getRequestedOwnerUid(request: Request, authenticatedUserId: string): string | null {
  const header = request.headers.get('X-Owner-UID');
  if (!header || header === authenticatedUserId) return null;
  return header;
}
