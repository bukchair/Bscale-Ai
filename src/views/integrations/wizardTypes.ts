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

export const WIZARD_STORAGE_PREFIX = 'bscale.integrations.wizardDraft';

export const WIZARD_PLATFORM_OPTIONS: Array<{ id: WizardPlatform; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'meta', label: 'Meta' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'woocommerce', label: 'WooCommerce' },
  { id: 'shopify', label: 'Shopify' },
];

export const WIZARD_FIELDS: Record<WizardPlatform, WizardField[]> = {
  google: [
    { key: 'googleAdsId', labelHe: 'מזהה חשבון מודעות', labelEn: 'Ads account ID', placeholder: '123-456-7890', required: true },
    { key: 'loginCustomerId', labelHe: 'Login Customer ID', labelEn: 'Login Customer ID', placeholder: '123-456-7890' },
    { key: 'ga4Id', labelHe: 'GA4 Property ID', labelEn: 'GA4 Property ID', placeholder: '123456789' },
    { key: 'siteUrl', labelHe: 'Site URL ל-GSC', labelEn: 'Site URL for GSC', placeholder: 'https://example.com', type: 'url' },
    { key: 'googleAccessToken', labelHe: 'Google Access Token', labelEn: 'Google Access Token', placeholder: 'ya29...' },
  ],
  meta: [
    { key: 'metaAdsId', labelHe: 'מזהה חשבון מודעות', labelEn: 'Ads account ID', placeholder: 'act_123456789', required: true },
    { key: 'pixelId', labelHe: 'Pixel ID', labelEn: 'Pixel ID', placeholder: '123456789012345', required: true },
    { key: 'businessId', labelHe: 'Business Manager ID', labelEn: 'Business Manager ID', placeholder: '112233445566778' },
    { key: 'metaToken', labelHe: 'Meta Access Token', labelEn: 'Meta Access Token', placeholder: 'EAAB...' },
  ],
  tiktok: [
    { key: 'tiktokAdvertiserId', labelHe: 'Advertiser ID', labelEn: 'Advertiser ID', placeholder: '7012345678901234567', required: true },
    { key: 'tiktokPixelId', labelHe: 'Pixel ID', labelEn: 'Pixel ID', placeholder: 'TT-PIXEL-123' },
  ],
  woocommerce: [
    { key: 'storeUrl', labelHe: 'כתובת החנות', labelEn: 'Store URL', placeholder: 'https://mystore.com', type: 'url', required: true },
    { key: 'wooKey', labelHe: 'Consumer Key', labelEn: 'Consumer Key', placeholder: 'ck_...', required: true },
    { key: 'wooSecret', labelHe: 'Consumer Secret', labelEn: 'Consumer Secret', placeholder: 'cs_...', required: true, type: 'password' },
  ],
  shopify: [
    { key: 'storeUrl', labelHe: 'כתובת החנות', labelEn: 'Store URL', placeholder: 'https://mystore.myshopify.com', type: 'url', required: true },
    { key: 'shopifyToken', labelHe: 'Admin API Access Token', labelEn: 'Admin API Access Token', placeholder: 'shpat_...', required: true, type: 'password' },
  ],
};
