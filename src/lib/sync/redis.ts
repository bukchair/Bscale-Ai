import IORedis, { type RedisOptions } from 'ioredis';
import { syncEnv } from './env';

let redisSingleton: IORedis | null = null;

const createRedis = () => {
  if (syncEnv.REDIS_URL) {
    return new IORedis(syncEnv.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  if (!syncEnv.REDIS_HOST) return null;
  const options: RedisOptions = {
    host: syncEnv.REDIS_HOST,
    port: syncEnv.REDIS_PORT,
    password: syncEnv.REDIS_PASSWORD || undefined,
    tls: syncEnv.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  };
  return new IORedis(options);
};

export const getRedis = async (): Promise<IORedis | null> => {
  if (!redisSingleton) {
    redisSingleton = createRedis();
  }
  if (!redisSingleton) return null;
  if (redisSingleton.status === 'wait') {
    await redisSingleton.connect();
  }
  return redisSingleton;
};
