import type { ReactNode } from 'react';
import { Connection } from '../../contexts/ConnectionsContext';

export type ManagedGoogleAdsAccount = {
  externalAccountId: string;
  name?: string;
  isSelected?: boolean;
  status?: string;
  currency?: string | null;
  timezone?: string | null;
};

export type MetaAssetOption = {
  id: string;
  name: string;
  isSelected?: boolean;
};

export type MetaPixelOption = {
  id: string;
  name: string;
  adAccountId?: string;
};

export type MetaAssetsPayload = {
  adAccounts: MetaAssetOption[];
  businesses: MetaAssetOption[];
  messageAccounts: MetaAssetOption[];
  pixels: MetaPixelOption[];
  warnings?: string[];
  defaultAdAccountId?: string;
  defaultBusinessId?: string;
  defaultMessageAccountId?: string;
  defaultPixelId?: string;
};

export type WizardPlatform = 'google' | 'meta' | 'tiktok' | 'woocommerce' | 'shopify';
export type WizardStep = 1 | 2 | 3;

export type WizardField = {
  key: string;
  labelHe: string;
  labelEn: string;
  placeholder: string;
  required?: boolean;
  type?: 'text' | 'password' | 'url';
};

export type WizardDraft = {
  platform: WizardPlatform;
  step: WizardStep;
  values: Record<string, string>;
  completedPlatforms: WizardPlatform[];
  updatedAt: number;
};

export type TabId = 'overview' | 'google' | 'meta' | 'tiktok' | 'whatsapp' | 'more';

export type RenderConnectionCard = (integration: Connection) => ReactNode;
export type RenderIntegrationSettings = (integration: Connection) => ReactNode;
