import type { Platform } from '@/src/lib/integrations/core/types';
import { prisma } from '@/src/lib/db/prisma';
import { toPrismaJson } from '@/src/lib/integrations/utils/prisma-json';

type AuditInput = {
  userId: string;
  action: string;
  platform?: Platform;
  connectionId?: string;
  details?: Record<string, unknown>;
};

export const auditService = {
  async log(input: AuditInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        platform: input.platform,
        connectionId: input.connectionId,
        details: input.details ? toPrismaJson(input.details) : undefined,
      },
    });
  },
};
