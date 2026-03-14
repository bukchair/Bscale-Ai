import { z } from 'zod';

export const selectAccountsSchema = z.object({
  accountIds: z.array(z.string().min(1)).max(500),
});

export type SelectAccountsInput = z.infer<typeof selectAccountsSchema>;

export const testConnectionSchema = z.object({
  accountId: z.string().min(1).optional(),
});

export type TestConnectionInput = z.infer<typeof testConnectionSchema>;

export const syncSchema = z.object({
  accountId: z.string().min(1).optional(),
  forceRefresh: z.boolean().optional().default(false),
});

export type SyncInput = z.infer<typeof syncSchema>;
