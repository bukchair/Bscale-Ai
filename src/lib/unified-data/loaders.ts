import { fetchGoogleCampaigns } from '../../services/googleService';
import { fetchMetaCampaigns } from '../../services/metaService';
import { fetchTikTokCampaigns } from '../../services/tiktokService';
import {
  mapGoogleCampaignRowsToUnifiedLayer,
  mapMetaCampaignRowsToUnifiedLayer,
  mapTikTokCampaignRowsToUnifiedLayer,
  mergeUnifiedDataLayers,
  unifiedLayerToCampaignRows,
} from './mappers';
import { createEmptyUnifiedDataLayer, type UnifiedDataLayer } from './types';

type ConnectionLike = {
  id: string;
  status: string;
  settings?: Record<string, unknown>;
};

type LoadUnifiedCampaignLayerInput = {
  connections: ConnectionLike[];
  startDate?: string;
  endDate?: string;
};

type LoadUnifiedCampaignLayerResult = {
  layer: UnifiedDataLayer;
  campaignRows: any[];
  errors: Partial<Record<'Google' | 'Meta' | 'TikTok', string>>;
};

const text = (value: unknown) => String(value ?? '').trim();

export const loadUnifiedCampaignLayerFromConnections = async (
  input: LoadUnifiedCampaignLayerInput
): Promise<LoadUnifiedCampaignLayerResult> => {
  const { connections, startDate, endDate } = input;
  const googleConnection = connections.find((c) => c.id === 'google' && c.status === 'connected');
  const metaConnection = connections.find((c) => c.id === 'meta' && c.status === 'connected');
  const tiktokConnection = connections.find((c) => c.id === 'tiktok' && c.status === 'connected');

  const errors: Partial<Record<'Google' | 'Meta' | 'TikTok', string>> = {};
  const layers: UnifiedDataLayer[] = [];

  const tasks: Array<Promise<void>> = [];

  const googleToken = googleConnection
    ? text(googleConnection.settings?.googleAccessToken) || 'server-managed'
    : '';
  const googleCustomerId = text(
    googleConnection?.settings?.googleAdsId ||
      googleConnection?.settings?.customerId ||
      googleConnection?.settings?.googleCustomerId
  );
  const googleLoginCustomerId = text(googleConnection?.settings?.loginCustomerId);
  if (googleConnection && googleToken) {
    tasks.push(
      fetchGoogleCampaigns(
        googleToken,
        googleCustomerId || undefined,
        googleLoginCustomerId || undefined,
        startDate,
        endDate
      )
        .then((rows) => {
          layers.push(
            mapGoogleCampaignRowsToUnifiedLayer(rows, {
              accountExternalId: googleCustomerId || undefined,
              dateRange: { startDate, endDate },
            })
          );
        })
        .catch((error) => {
          errors.Google = error instanceof Error ? error.message : 'Failed to load Google campaigns.';
        })
    );
  }

  const metaToken = metaConnection
    ? text(metaConnection.settings?.metaToken) || 'server-managed'
    : '';
  const metaAdAccountId = text(
    metaConnection?.settings?.metaAdsId ||
      metaConnection?.settings?.adAccountId ||
      metaConnection?.settings?.metaAdAccountId
  );
  if (metaConnection && metaToken) {
    tasks.push(
      fetchMetaCampaigns(metaToken, metaAdAccountId || undefined, startDate, endDate)
        .then((rows) => {
          layers.push(
            mapMetaCampaignRowsToUnifiedLayer(rows, {
              accountExternalId: metaAdAccountId || undefined,
              dateRange: { startDate, endDate },
            })
          );
        })
        .catch((error) => {
          errors.Meta = error instanceof Error ? error.message : 'Failed to load Meta campaigns.';
        })
    );
  }

  const tiktokToken = text(
    tiktokConnection?.settings?.tiktokToken ||
      tiktokConnection?.settings?.tiktokAccessToken ||
      tiktokConnection?.settings?.accessToken
  );
  const tiktokAdvertiserId = text(
    tiktokConnection?.settings?.tiktokAdvertiserId || tiktokConnection?.settings?.advertiserId
  );
  if (tiktokConnection && tiktokToken && tiktokAdvertiserId) {
    tasks.push(
      fetchTikTokCampaigns(tiktokToken, tiktokAdvertiserId, startDate, endDate)
        .then((rows) => {
          layers.push(
            mapTikTokCampaignRowsToUnifiedLayer(rows, {
              accountExternalId: tiktokAdvertiserId,
              dateRange: { startDate, endDate },
            })
          );
        })
        .catch((error) => {
          errors.TikTok = error instanceof Error ? error.message : 'Failed to load TikTok campaigns.';
        })
    );
  }

  await Promise.all(tasks);

  const layer = layers.length > 0 ? mergeUnifiedDataLayers(layers) : createEmptyUnifiedDataLayer();
  const campaignRows = unifiedLayerToCampaignRows(layer).sort(
    (a, b) => Number(b?.spend || 0) - Number(a?.spend || 0)
  );

  return {
    layer,
    campaignRows,
    errors,
  };
};
