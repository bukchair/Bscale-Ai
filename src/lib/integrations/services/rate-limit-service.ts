import { prisma } from '@/src/lib/db/prisma';
import { IntegrationError } from '@/src/lib/integrations/core/errors';

type RateLimitInput = {
  userId: string;
  key: string;
  limit: number;
  windowSeconds: number;
};

export const rateLimitService = {
  async enforce({ userId, key, limit, windowSeconds }: RateLimitInput): Promise<void> {
    const since = new Date(Date.now() - windowSeconds * 1000);
    const action = `rate_limit:${key}`;

    const attempts = await prisma.auditLog.count({
      where: {
        userId,
        action,
        createdAt: { gte: since },
      },
    });

    if (attempts >= limit) {
      throw new IntegrationError('RATE_LIMITED', 'Too many requests, please retry later.', 429);
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: {
          windowSeconds,
          limit,
        },
      },
    });
  },
};
