import type { Prisma } from '@prisma/client';

export const toPrismaJson = (value: unknown): Prisma.InputJsonValue => {
  return value as Prisma.InputJsonValue;
};
