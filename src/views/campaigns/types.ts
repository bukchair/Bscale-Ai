// Types, constants, and pure helpers extracted from Campaigns.tsx

export type CampaignRow = Record<string, unknown>;

export type ContentType = 'product' | 'offer' | 'educational' | 'testimonial' | 'video';
export type ProductType = 'fashion' | 'beauty' | 'tech' | 'home' | 'fitness' | 'services' | 'other';
export type ObjectiveType = 'sales' | 'traffic' | 'leads' | 'awareness' | 'retargeting';
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type RuleAction = 'boost' | 'limit' | 'pause';
export type PlatformName = 'Google' | 'Meta' | 'TikTok';

export type UploadedAsset = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  file: File;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
};

export type TimeRule = {
  id: string;
  platform: PlatformName;
  startHour: number;
  endHour: number;
  action: RuleAction;
  minRoas: number;
  reason?: string;
};

export type DayHours = Record<DayKey, number[]>;
export type WeeklySchedule = Record<string, DayHours>;

export type MediaLimits = {
  imageMaxMb: number;
  videoMaxMb: number;
  maxImageWidth: number;
  maxImageHeight: number;
};

export type EditableStatus = 'Active' | 'Paused';

export type EditCampaignDraft = {
  rowKey: string;
  platform: PlatformName;
  campaignId: string;
  name: string;
  status: EditableStatus;
  dailyBudget: string;
};

export type WooCampaignProduct = {
  id: number;
  name: string;
  categories: string[];
  price?: string;
  shortDescription?: string;
  description?: string;
  sku?: string;
  stockQuantity?: number | null;
};

export type WooPublishScope = 'category' | 'product';

export type PlatformCopyDraft = {
  title: string;
  description: string;
};

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const PLATFORM_MEDIA_LIMITS: Record<PlatformName, MediaLimits> = {
  Google: { imageMaxMb: 5, videoMaxMb: 100, maxImageWidth: 1200, maxImageHeight: 1200 },
  Meta: { imageMaxMb: 30, videoMaxMb: 500, maxImageWidth: 1440, maxImageHeight: 1440 },
  TikTok: { imageMaxMb: 20, videoMaxMb: 500, maxImageWidth: 1080, maxImageHeight: 1920 },
};

export const SMART_AUDIENCE_BY_CONTENT: Record<ContentType, string[]> = {
  product: ['Product viewers 30d', 'Cart abandoners 14d', 'Lookalike 1% - Purchasers'],
  offer: ['Price sensitive shoppers', 'Promo clickers 30d', 'Coupon users'],
  educational: ['Blog readers 60d', 'Video viewers 75%', 'Top funnel warm audience'],
  testimonial: ['Consideration audience', 'Review seekers', 'Competitor audience'],
  video: ['Short video engagers', 'Watch time > 15s', 'Reels/TikTok engagers'],
};

export const SMART_AUDIENCE_BY_PRODUCT: Record<ProductType, string[]> = {
  fashion: ['Fashion interest', 'Streetwear audience', 'Seasonal shoppers'],
  beauty: ['Beauty products interest', 'Skincare enthusiasts', 'Self care audience'],
  tech: ['Tech enthusiasts', 'Gadget buyers', 'Early adopters'],
  home: ['Home improvement', 'Interior design audience', 'Family buyers'],
  fitness: ['Fitness audience', 'Running & sports', 'Healthy lifestyle'],
  services: ['High intent leads', 'Local business services', 'Consultation seekers'],
  other: ['Broad prospecting', 'Engaged audience 30d'],
};

export const SMART_AUDIENCE_BY_OBJECTIVE: Record<ObjectiveType, string[]> = {
  sales: ['High intent purchasers', 'Returning buyers', 'Upsell audience'],
  traffic: ['Click propensity audience', 'Content consumers'],
  leads: ['Lead forms engagers', 'WhatsApp clickers', 'Contact page visitors'],
  awareness: ['Broad awareness 18-44', 'Reach optimized audience'],
  retargeting: ['Site visitors 30d', 'Product viewers 14d', 'Initiated checkout 14d'],
};

export const createEmptyDaySchedule = (): DayHours => ({
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
});

export const stripHtmlToText = (value: unknown): string =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
