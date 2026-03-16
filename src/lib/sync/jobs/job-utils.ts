import type { Platform } from '@/src/lib/integrations/core/types';

export const startOfUtcDay = (dayIso: string) => new Date(`${dayIso}T00:00:00.000Z`);
export const endOfUtcDay = (dayIso: string) => new Date(`${dayIso}T23:59:59.999Z`);

export const platformToUnified = (platform: Platform): 'Google' | 'Meta' | 'TikTok' => {
  if (platform === 'GOOGLE_ADS') return 'Google';
  if (platform === 'META') return 'Meta';
  return 'TikTok';
};
