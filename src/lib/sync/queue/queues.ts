import { Queue, type JobsOptions, type QueueOptions } from 'bullmq';
import { syncEnv } from '../env';

const queueConnection: QueueOptions['connection'] = syncEnv.REDIS_URL
  ? { url: syncEnv.REDIS_URL }
  : {
      host: syncEnv.REDIS_HOST || '127.0.0.1',
      port: syncEnv.REDIS_PORT,
      password: syncEnv.REDIS_PASSWORD || undefined,
      tls: syncEnv.REDIS_TLS ? {} : undefined,
    };

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 2000 },
};

let syncQueueSingleton: Queue | null = null;
let actionsQueueSingleton: Queue | null = null;

export const getSyncQueue = () => {
  if (!syncQueueSingleton) {
    syncQueueSingleton = new Queue('bscale-sync', {
      connection: queueConnection,
      defaultJobOptions,
    });
  }
  return syncQueueSingleton;
};

export const getActionsQueue = () => {
  if (!actionsQueueSingleton) {
    actionsQueueSingleton = new Queue('bscale-actions', {
      connection: queueConnection,
      defaultJobOptions,
    });
  }
  return actionsQueueSingleton;
};

export const queueDefaults = {
  connection: queueConnection,
  defaultJobOptions,
};
