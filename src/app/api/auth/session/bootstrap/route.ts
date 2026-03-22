import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Firebase-based bootstrap endpoint — deprecated.
 * Authentication is now handled via cookie-based sessions.
 * All clients have been updated to no-op this call.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, errorCode: 'DEPRECATED', message: 'This endpoint is no longer in use.' },
    { status: 410 }
  );
}
