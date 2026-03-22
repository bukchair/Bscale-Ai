import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';
import { Prisma } from '@prisma/client';

// Admin settings are stored in a dedicated system user record or as a global JSON.
// We use the admin user's own settings as a namespace for app-wide admin config.

async function requireAdmin() {
  const user = await requireAuthenticatedUser();
  if (user.role !== 'admin') throw new Error('Forbidden');
  return user;
}

async function getAdminSettings(adminId: string): Promise<Record<string, unknown>> {
  const dbUser = await prisma.user.findUnique({
    where: { id: adminId },
    select: { settings: true },
  });
  const settings = (dbUser?.settings ?? {}) as Record<string, unknown>;
  return (settings.adminConfig ?? {}) as Record<string, unknown>;
}

// GET /api/admin/settings — returns admin app settings
export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
  }

  const config = await getAdminSettings(admin.id);
  return NextResponse.json({ settings: config });
}

// PATCH /api/admin/settings — merges admin app settings
export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { settings: true },
  });
  const currentSettings = (dbUser?.settings ?? {}) as Record<string, unknown>;
  const currentAdminConfig = (currentSettings.adminConfig ?? {}) as Record<string, unknown>;
  const merged = { ...currentAdminConfig, ...body };

  await prisma.user.update({
    where: { id: admin.id },
    data: { settings: { ...currentSettings, adminConfig: merged } as Prisma.InputJsonValue },
  });

  return NextResponse.json({ success: true, settings: merged });
}
