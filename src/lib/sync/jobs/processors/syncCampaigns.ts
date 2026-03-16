import { prisma } from '@/src/lib/db/prisma';
import { mapGoogleCampaignRowsToUnifiedLayer, mapMetaCampaignRowsToUnifiedLayer, mapTikTokCampaignRowsToUnifiedLayer } from '@/src/lib/unified-data/mappers';
import { googleAdsConnector } from '@/src/lib/sync/connectors/googleAds';
import { metaAdsConnector } from '@/src/lib/sync/connectors/metaAds';
import { tiktokAdsConnector } from '@/src/lib/sync/connectors/tiktokAds';
import { unifiedRepo } from '@/src/lib/sync/repository/unifiedRepo';
import type { SyncCampaignsPayload } from '@/src/lib/sync/queue/payloads';
import { syncEnv } from '@/src/lib/sync/env';

export const processSyncCampaigns = async (payload: SyncCampaignsPayload) => {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: payload.connectedAccountId, userId: payload.userId, platformConnectionId: payload.connectionId },
    select: {
      id: true,
      externalAccountId: true,
      currency: true,
      timezone: true,
    },
  });
  if (!account) {
    return { synced: 0, skipped: true, reason: 'Connected account not found.' };
  }

  let rows: any[] = [];
  if (payload.platform === 'GOOGLE_ADS') {
    rows = await googleAdsConnector.fetchCampaigns(payload.connectionId, account.externalAccountId.replace(/\D/g, ''));
    const layer = mapGoogleCampaignRowsToUnifiedLayer(rows, {
      accountExternalId: account.externalAccountId,
      currency: account.currency || undefined,
      timezone: account.timezone || undefined,
    });
    await unifiedRepo.upsertLayer(payload.userId, layer);
    return { synced: rows.length };
  }

  if (payload.platform === 'META') {
    rows = await metaAdsConnector.fetchCampaigns(payload.connectionId, account.externalAccountId);
    const layer = mapMetaCampaignRowsToUnifiedLayer(rows, {
      accountExternalId: account.externalAccountId,
      currency: account.currency || undefined,
      timezone: account.timezone || undefined,
    });
    await unifiedRepo.upsertLayer(payload.userId, layer);
    return { synced: rows.length };
  }

  if (payload.platform === 'TIKTOK') {
    if (!syncEnv.TIKTOK_SYNC_ENABLED) {
      return { synced: 0, skipped: true, reason: 'TIKTOK_SYNC_ENABLED=false' };
    }
    rows = await tiktokAdsConnector.fetchCampaigns(payload.connectionId, account.externalAccountId);
    const layer = mapTikTokCampaignRowsToUnifiedLayer(rows, {
      accountExternalId: account.externalAccountId,
      currency: account.currency || undefined,
      timezone: account.timezone || undefined,
    });
    await unifiedRepo.upsertLayer(payload.userId, layer);
    return { synced: rows.length };
  }

  return { synced: 0, skipped: true, reason: `Platform ${payload.platform} has no campaign sync.` };
};
