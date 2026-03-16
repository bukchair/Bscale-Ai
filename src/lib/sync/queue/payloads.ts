import { z } from 'zod';
import type { Platform } from '@/src/lib/integrations/core/types';

export const refreshTokensPayloadSchema = z.object({
  scope: z.enum(['all', 'connection']),
  connectionId: z.string().min(1).optional(),
  force: z.boolean().optional().default(false),
});
export type RefreshTokensPayload = z.infer<typeof refreshTokensPayloadSchema>;

export const syncAccountsPayloadSchema = z.object({
  userId: z.string().min(1),
  connectionId: z.string().min(1),
  platform: z.custom<Platform>(),
  requestedBy: z.enum(['cron', 'user']),
});
export type SyncAccountsPayload = z.infer<typeof syncAccountsPayloadSchema>;

export const syncCampaignsPayloadSchema = z.object({
  userId: z.string().min(1),
  connectionId: z.string().min(1),
  platform: z.custom<Platform>(),
  connectedAccountId: z.string().min(1),
  fullSync: z.boolean(),
  requestedBy: z.enum(['cron', 'user']),
});
export type SyncCampaignsPayload = z.infer<typeof syncCampaignsPayloadSchema>;

export const syncMetricsPayloadSchema = z.object({
  userId: z.string().min(1),
  connectionId: z.string().min(1),
  platform: z.custom<Platform>(),
  connectedAccountId: z.string().min(1),
  range: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  granularity: z.enum(['hour', 'day']),
  mode: z.enum(['cumulative', 'byDate']),
  requestedBy: z.enum(['cron', 'user']),
});
export type SyncMetricsPayload = z.infer<typeof syncMetricsPayloadSchema>;

export const snapshotDailyPayloadSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SnapshotDailyPayload = z.infer<typeof snapshotDailyPayloadSchema>;

export const actionPayloadSchema = z.object({
  userId: z.string().min(1),
  platform: z.custom<Platform>(),
  connectionId: z.string().min(1),
  connectedAccountId: z.string().min(1),
  actionType: z.string().min(1),
  targetExternalId: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type ActionPayload = z.infer<typeof actionPayloadSchema>;
