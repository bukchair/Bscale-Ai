import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, type AuthenticatedUser } from '@/src/lib/auth/session';
import { logWithUserContext } from '@/src/lib/logging/server-structured-log';

type Handler = (req: Request, user: AuthenticatedUser) => Promise<Response>;
type HandlerWithParams<P> = (req: Request, user: AuthenticatedUser, params: P) => Promise<Response>;

/**
 * Wraps a Next.js route handler with automatic auth + error logging.
 * The handler receives the authenticated user as a second argument —
 * no need to call requireAuthenticatedUser() inside the route.
 *
 * Usage (no route params):
 *   export const GET = withUserLogging(async (req, user) => { ... });
 *
 * Usage (with route params):
 *   export const POST = withUserLogging(async (req, user, { platform }) => { ... },
 *     { params: Promise<{ platform: string }> }
 *   );
 */
export function withUserLogging(handler: Handler) {
  return async (req: Request): Promise<Response> => {
    const path = new URL(req.url).pathname;
    const method = req.method;
    let user: AuthenticatedUser | undefined;
    try {
      user = await requireAuthenticatedUser();
      return await handler(req, user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = (error as { statusCode?: number })?.statusCode ?? 500;
      if (status >= 500) {
        logWithUserContext('ERROR', `${method} ${path} failed`, {
          userEmail: user?.email,
          userId: user?.id,
          path,
          method,
          error: message,
          status,
        });
      }
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export function withUserLoggingParams<P>(handler: HandlerWithParams<P>) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    const path = new URL(req.url).pathname;
    const method = req.method;
    let user: AuthenticatedUser | undefined;
    try {
      user = await requireAuthenticatedUser();
      const params = await ctx.params;
      return await handler(req, user, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = (error as { statusCode?: number })?.statusCode ?? 500;
      if (status >= 500) {
        logWithUserContext('ERROR', `${method} ${path} failed`, {
          userEmail: user?.email,
          userId: user?.id,
          path,
          method,
          error: message,
          status,
        });
      }
      return NextResponse.json({ error: message }, { status });
    }
  };
}
