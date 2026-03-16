import type { SnapshotDailyPayload } from '@/src/lib/sync/queue/payloads';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';

export const processSnapshotDaily = async (payload: SnapshotDailyPayload) => {
  const row = await unifiedRepo.buildDailySnapshot(payload.userId, payload.date);
  return {
    snapshotId: row.id,
    date: payload.date,
  };
};
