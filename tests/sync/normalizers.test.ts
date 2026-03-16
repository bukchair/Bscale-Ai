import { describe, expect, it } from 'vitest';
import { mapGoogleCampaignRowsToUnifiedLayer, unifiedLayerToCampaignRows } from '../../src/lib/unified-data/mappers';

describe('unified normalizers', () => {
  it('maps google campaign rows to unified entities', () => {
    const layer = mapGoogleCampaignRowsToUnifiedLayer([
      {
        id: '123',
        campaignId: '123',
        name: 'Campaign A',
        status: 'ENABLED',
        spend: 10,
        impressions: 1000,
        clicks: 25,
        conversions: 3,
        conversionValue: 40,
      },
    ]);
    expect(layer.campaigns.length).toBe(1);
    expect(layer.accounts.length).toBe(1);
    expect(layer.metrics.length).toBe(1);
    const rows = unifiedLayerToCampaignRows(layer);
    expect(rows[0].platform).toBe('Google');
    expect(rows[0].spend).toBe(10);
  });
});
