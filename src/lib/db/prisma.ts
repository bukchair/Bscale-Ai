import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
  // eslint-disable-next-line no-var
  var __bscalePrisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required in production runtime for Prisma.');
    }
    // Local fallback for development environments without a configured DB.
    return new PrismaClient({
      adapter: new PrismaPg({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/bscale_integrations',
      }),
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

function getPrismaClient() {
  if (!globalThis.__bscalePrisma__) {
    globalThis.__bscalePrisma__ = createPrismaClient();
  }
  return globalThis.__bscalePrisma__;
}

// Lazy proxy prevents Prisma constructor from running during module evaluation in Next build.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient() as Record<PropertyKey, unknown>;
    const value = client[property];
    return typeof value === 'function' ? (value as Function).bind(client) : value;
  },
  set(_target, property, value) {
    const client = getPrismaClient() as Record<PropertyKey, unknown>;
    client[property] = value;
    return true;
  },
}) as PrismaClient;
