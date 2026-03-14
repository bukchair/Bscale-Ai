import type { Platform } from '@/src/lib/integrations/core/types';

const slugToPlatform: Record<string, Platform> = {
  'google-ads': 'GOOGLE_ADS',
  ga4: 'GA4',
  'search-console': 'SEARCH_CONSOLE',
  gmail: 'GMAIL',
  meta: 'META',
  tiktok: 'TIKTOK',
  GOOGLE_ADS: 'GOOGLE_ADS',
  GA4: 'GA4',
  SEARCH_CONSOLE: 'SEARCH_CONSOLE',
  GMAIL: 'GMAIL',
  META: 'META',
  TIKTOK: 'TIKTOK',
};

export const parsePlatformParam = (platform: string): Platform => {
  const parsed = slugToPlatform[platform];
  if (!parsed) {
    throw new Error(`Unsupported platform route parameter: ${platform}`);
  }
  return parsed;
};

const platformToSlug: Record<Platform, string> = {
  GOOGLE_ADS: 'google-ads',
  GA4: 'ga4',
  SEARCH_CONSOLE: 'search-console',
  GMAIL: 'gmail',
  META: 'meta',
  TIKTOK: 'tiktok',
};

export const toRoutePlatform = (platform: Platform): string => platformToSlug[platform];
