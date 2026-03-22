import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Firebase-based bootstrap endpoint — deprecated.
 * Authentication is now handled via cookie-based sessions.
 * Returns 200 so legacy clients / cached bundles do not treat the call as a hard failure.
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    deprecated: true,
    message: 'Session uses httpOnly cookie; no bootstrap needed.',
  });
}
