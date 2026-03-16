import { getRedis } from '../redis';

export const cacheClient = {
  async getJson<T>(key: string): Promise<T | null> {
    const redis = await getRedis();
    if (!redis) return null;
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = await getRedis();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), 'EX', Math.max(1, ttlSeconds));
  },

  async del(key: string): Promise<void> {
    const redis = await getRedis();
    if (!redis) return;
    await redis.del(key);
  },
};
