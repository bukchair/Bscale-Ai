// Shared types and helpers used by Integrations.tsx and IntegrationSettingsPanel.tsx

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
