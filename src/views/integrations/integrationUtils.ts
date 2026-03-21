// Shared types, helpers, and constants used by Integrations.tsx and sub-components
import React from 'react';
import { Plug, ShoppingCart, Store, Megaphone, Video, Facebook, Sparkles, Zap, BrainCircuit } from 'lucide-react';
import type { Connection } from '../../contexts/ConnectionsContext';

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

export const normalizeGoogleAdsAccountId = (value: string) => value.replace(/\D/g, '');

export const formatGoogleAdsAccountId = (value: string) => {
  const digits = normalizeGoogleAdsAccountId(value);
  if (digits.length !== 10) return digits || value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const normalizeMetaAccountId = (value: string) =>
  String(value || '').replace(/^act_/i, '').trim();

export const parseManagedGoogleAdsAccounts = (raw: string | undefined): ManagedGoogleAdsAccount[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const externalAccountId = String(row.externalAccountId || '').trim();
        if (!externalAccountId) return null;
        return {
          externalAccountId,
          name: typeof row.name === 'string' ? row.name : '',
          isSelected: Boolean(row.isSelected),
          status: typeof row.status === 'string' ? row.status : undefined,
          currency: typeof row.currency === 'string' ? row.currency : null,
          timezone: typeof row.timezone === 'string' ? row.timezone : null,
        } as ManagedGoogleAdsAccount;
      })
      .filter((item): item is ManagedGoogleAdsAccount => Boolean(item));
  } catch {
    return [];
  }
};

// ── Connection card constants ──────────────────────────────────────────────────

export const INTEGRATION_ICON_MAP: Record<string, React.ElementType> = {
  gemini: Sparkles,
  openai: Zap,
  claude: BrainCircuit,
  google: Megaphone,
  meta: Facebook,
  tiktok: Video,
  woocommerce: ShoppingCart,
  shopify: Store,
};

export type BrandStyle = { bg: string; text: string; border: string; lightBg: string };

export const INTEGRATION_BRAND_STYLES: Record<string, BrandStyle> = {
  gemini:     { bg: 'bg-gradient-to-br from-purple-500 to-blue-500',    text: 'text-white', border: 'border-purple-200',  lightBg: 'bg-purple-50' },
  openai:     { bg: 'bg-gradient-to-br from-emerald-600 to-teal-600',   text: 'text-white', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
  claude:     { bg: 'bg-gradient-to-br from-amber-600 to-orange-600',   text: 'text-white', border: 'border-amber-200',   lightBg: 'bg-amber-50' },
  google:     { bg: 'bg-gradient-to-br from-blue-500 to-red-400',       text: 'text-white', border: 'border-blue-200',    lightBg: 'bg-blue-50' },
  meta:       { bg: 'bg-gradient-to-br from-blue-600 to-blue-700',      text: 'text-white', border: 'border-blue-200',    lightBg: 'bg-blue-50' },
  tiktok:     { bg: 'bg-gradient-to-br from-gray-800 to-black',         text: 'text-white', border: 'border-gray-300',    lightBg: 'bg-gray-100' },
  woocommerce:{ bg: 'bg-gradient-to-br from-purple-600 to-purple-800',  text: 'text-white', border: 'border-purple-200',  lightBg: 'bg-purple-50' },
  shopify:    { bg: 'bg-gradient-to-br from-emerald-500 to-green-600',  text: 'text-white', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
};

const DEFAULT_BRAND: BrandStyle = { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-200', lightBg: 'bg-gray-50' };
export const getIntegrationBrand = (id: string): BrandStyle =>
  INTEGRATION_BRAND_STYLES[id] ?? DEFAULT_BRAND;

// ── Active account summary ─────────────────────────────────────────────────────

export const getActiveAccountSummary = (integration: Connection): string | null => {
  const settings = integration.settings || {};

  if (integration.id === 'google') {
    const managedAccounts = parseManagedGoogleAdsAccounts(settings.googleAdsAccounts);
    const selected = managedAccounts.find((a) => a.isSelected) || managedAccounts[0];
    if (selected?.externalAccountId) {
      const formatted = formatGoogleAdsAccountId(selected.externalAccountId);
      return selected.name ? `${selected.name} (${formatted})` : formatted;
    }
    if (settings.googleAdsId) return formatGoogleAdsAccountId(settings.googleAdsId);
    return null;
  }
  if (integration.id === 'meta') return String(settings.metaAdsId || '').trim() || null;
  if (integration.id === 'tiktok') return String(settings.tiktokAdvertiserId || '').trim() || null;
  if (integration.id === 'woocommerce' || integration.id === 'shopify')
    return String(settings.storeUrl || '').trim() || null;

  return null;
};
