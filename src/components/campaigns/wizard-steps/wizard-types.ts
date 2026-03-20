/**
 * Shared types and constants for OneClickWizard step sub-components.
 */
import type { OneClickObjective, OneClickPlatform } from '../../../lib/one-click/types';

export type WizardStep = 1 | 2 | 3 | 4 | 5;
export type ProductSource = 'manual' | 'woocommerce';

export interface WizardProduct {
  name: string;
  description: string;
  price: string;
  url: string;
  imageUrl?: string;
}

export const PLATFORM_COLORS: Record<OneClickPlatform, string> = {
  Google: 'border-blue-300 bg-blue-50 text-blue-800',
  Meta: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  TikTok: 'border-pink-300 bg-pink-50 text-pink-800',
};

export const PLATFORM_SELECTED: Record<OneClickPlatform, string> = {
  Google: 'border-blue-500 bg-blue-100 ring-2 ring-blue-400',
  Meta: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-400',
  TikTok: 'border-pink-500 bg-pink-100 ring-2 ring-pink-400',
};

export const PLATFORM_ICONS: Record<OneClickPlatform, string> = {
  Google: '🔵',
  Meta: '🟣',
  TikTok: '⚫',
};

export const OBJECTIVES: {
  value: OneClickObjective;
  labelEn: string;
  labelHe: string;
  icon: string;
  descEn: string;
  descHe: string;
}[] = [
  {
    value: 'sales',
    labelEn: 'Sales',
    labelHe: 'מכירות',
    icon: '🛒',
    descEn: 'Drive purchases and conversions',
    descHe: 'הגדל מכירות והמרות',
  },
  {
    value: 'leads',
    labelEn: 'Leads',
    labelHe: 'לידים',
    icon: '📋',
    descEn: 'Collect contact info and inquiries',
    descHe: 'איסוף פרטי לקוחות פוטנציאליים',
  },
  {
    value: 'traffic',
    labelEn: 'Traffic',
    labelHe: 'תנועה',
    icon: '🌐',
    descEn: 'Send visitors to your website',
    descHe: 'הפנה מבקרים לאתר שלך',
  },
];

export const COUNTRIES = [
  { code: 'IL', label: 'Israel 🇮🇱' },
  { code: 'US', label: 'United States 🇺🇸' },
  { code: 'GB', label: 'United Kingdom 🇬🇧' },
  { code: 'DE', label: 'Germany 🇩🇪' },
  { code: 'FR', label: 'France 🇫🇷' },
  { code: 'CA', label: 'Canada 🇨🇦' },
  { code: 'AU', label: 'Australia 🇦🇺' },
  { code: 'NL', label: 'Netherlands 🇳🇱' },
];

export const LANGUAGES = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

export const STEP_LABELS_EN: Record<WizardStep, string> = {
  1: 'Platforms',
  2: 'Objective',
  3: 'Product',
  4: 'AI Preview',
  5: 'Result',
};

export const STEP_LABELS_HE: Record<WizardStep, string> = {
  1: 'פלטפורמות',
  2: 'מטרה',
  3: 'מוצר',
  4: 'תצוגה AI',
  5: 'תוצאה',
};

export const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const buildIdempotencyKey = (
  platforms: OneClickPlatform[],
  objective: string,
  budget: number,
  productName: string
): string =>
  `occ:${platforms.sort().join('+')}:${objective}:${budget}:${productName.slice(0, 30)}:${Math.floor(Date.now() / 60_000)}`;
