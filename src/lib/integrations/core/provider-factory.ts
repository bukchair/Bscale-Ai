import type { IntegrationProvider } from '@/src/lib/integrations/core/interfaces';
import type { Platform } from '@/src/lib/integrations/core/types';
import { UnsupportedCapabilityError } from '@/src/lib/integrations/core/errors';
import { GoogleAdsProvider } from '@/src/lib/integrations/providers/google-ads/provider';
import { Ga4Provider } from '@/src/lib/integrations/providers/ga4/provider';
import { SearchConsoleProvider } from '@/src/lib/integrations/providers/search-console/provider';
import { GmailProvider } from '@/src/lib/integrations/providers/gmail/provider';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { TikTokProvider } from '@/src/lib/integrations/providers/tiktok/provider';

const providers: Partial<Record<Platform, IntegrationProvider>> = {
  GOOGLE_ADS: new GoogleAdsProvider(),
  GA4: new Ga4Provider(),
  SEARCH_CONSOLE: new SearchConsoleProvider(),
  GMAIL: new GmailProvider(),
  META: new MetaProvider(),
  TIKTOK: new TikTokProvider(),
};

export const providerFactory = {
  get(platform: Platform): IntegrationProvider {
    const provider = providers[platform];
    if (!provider) {
      throw new UnsupportedCapabilityError(
        `Platform "${platform}" provider is not available yet.`
      );
    }
    return provider;
  },
};
