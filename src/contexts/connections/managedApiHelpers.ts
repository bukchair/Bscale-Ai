/**
 * Pure helper functions for mapping/merging managed API data into local Connection state.
 * No React or Firebase imports — fully unit-testable.
 */

import type { Connection, ConnectionSettings, ConnectionStatus } from '../ConnectionsContext';

// ── Types (re-exported for shared use) ───────────────────────────────────────

export type ManagedApiConnection = {
  platform: 'GOOGLE_ADS' | 'GA4' | 'SEARCH_CONSOLE' | 'GMAIL' | 'META' | 'TIKTOK';
  status: 'CONNECTED' | 'ERROR' | 'EXPIRED' | 'DISCONNECTED' | 'PENDING';
  accounts?: Array<{
    externalAccountId?: string;
    name?: string;
    isSelected?: boolean;
    status?: string;
    currency?: string | null;
    timezone?: string | null;
  }>;
};

export type ManagedPlatformSlug =
  | 'google-ads'
  | 'ga4'
  | 'search-console'
  | 'gmail'
  | 'meta'
  | 'tiktok';

export type ManagedPayload = {
  success?: boolean;
  message?: string;
  errorCode?: string;
  data?: { connections?: unknown; accounts?: unknown };
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

export const parseManagedPayload = (raw: string): ManagedPayload | null => {
  try {
    return raw ? (JSON.parse(raw) as ManagedPayload) : null;
  } catch {
    return null;
  }
};

export const mapManagedStatusToLocal = (
  status: ManagedApiConnection['status'] | undefined
): ConnectionStatus => {
  if (status === 'CONNECTED') return 'connected';
  if (status === 'PENDING') return 'connecting';
  if (status === 'ERROR' || status === 'EXPIRED') return 'error';
  return 'disconnected';
};

export const formatGoogleAdsAccountId = (value: string | undefined): string => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const normalizeGa4PropertyId = (value: string | undefined): string => {
  const trimmed = String(value || '').trim().replace(/^properties\//i, '');
  return /^\d+$/.test(trimmed) ? trimmed : '';
};

export function mergeManagedConnectionsIntoLocal(
  current: Connection[],
  managedConnections: ManagedApiConnection[]
): Connection[] {
  const byPlatform = new Map(managedConnections.map((row) => [row.platform, row] as const));
  const ads = byPlatform.get('GOOGLE_ADS');
  const ga4 = byPlatform.get('GA4');
  const gsc = byPlatform.get('SEARCH_CONSOLE');
  const gmail = byPlatform.get('GMAIL');
  const meta = byPlatform.get('META');
  const tiktok = byPlatform.get('TIKTOK');

  return current.map((connection) => {
    if (connection.id === 'google') {
      const nextSubConnections =
        connection.subConnections?.map((sub) => {
          if (sub.id === 'google_ads') return { ...sub, status: mapManagedStatusToLocal(ads?.status) };
          if (sub.id === 'ga4') return { ...sub, status: mapManagedStatusToLocal(ga4?.status) };
          if (sub.id === 'gsc') return { ...sub, status: mapManagedStatusToLocal(gsc?.status) };
          if (sub.id === 'gmail') return { ...sub, status: mapManagedStatusToLocal(gmail?.status) };
          return sub;
        }) || connection.subConnections;

      const nonArchived = (accounts?: ManagedApiConnection['accounts']) =>
        (accounts || []).filter((account) => account.status !== 'ARCHIVED');
      const adsAccounts = nonArchived(ads?.accounts);
      const ga4Accounts = nonArchived(ga4?.accounts);
      const gscAccounts = nonArchived(gsc?.accounts);
      const gmailAccounts = nonArchived(gmail?.accounts);

      const selectedAdsAccount = adsAccounts.find((a) => a.isSelected) || adsAccounts[0] || null;
      const selectedGa4 = ga4Accounts.find((a) => a.isSelected) || ga4Accounts[0] || null;
      const selectedGsc = gscAccounts.find((a) => a.isSelected) || gscAccounts[0] || null;
      const selectedGmail = gmailAccounts.find((a) => a.isSelected) || gmailAccounts[0] || null;

      const connectedSubCount = (nextSubConnections || []).filter((sub) => sub.status === 'connected').length;
      const googleManagedStatuses = [ads?.status, ga4?.status, gsc?.status, gmail?.status].filter(
        (value): value is ManagedApiConnection['status'] => Boolean(value)
      );

      const nextSettings: ConnectionSettings = { ...(connection.settings || {}) };

      if (selectedAdsAccount?.externalAccountId) {
        nextSettings.googleAdsId = formatGoogleAdsAccountId(selectedAdsAccount.externalAccountId);
      }
      const selectedGa4PropertyId = normalizeGa4PropertyId(selectedGa4?.externalAccountId);
      if (selectedGa4PropertyId) {
        nextSettings.ga4Id = selectedGa4PropertyId;
      } else if (nextSettings.ga4Id) {
        nextSettings.ga4Id = normalizeGa4PropertyId(nextSettings.ga4Id);
      }
      if (selectedGsc?.externalAccountId) {
        nextSettings.gscSiteUrl = selectedGsc.externalAccountId;
        nextSettings.siteUrl = selectedGsc.externalAccountId;
      }
      if (selectedGmail?.name) {
        nextSettings.gmailAccount = selectedGmail.name;
      }
      if (adsAccounts.length) {
        nextSettings.googleAdsAccounts = JSON.stringify(
          adsAccounts.map((account) => ({
            externalAccountId: account.externalAccountId,
            name: account.name,
            isSelected: Boolean(account.isSelected),
            status: account.status,
            currency: account.currency ?? null,
            timezone: account.timezone ?? null,
          }))
        );
      }
      if (googleManagedStatuses.some((s) => s === 'CONNECTED' || s === 'PENDING')) {
        nextSettings.googleAccessToken = 'server-managed';
      } else {
        delete nextSettings.googleAccessToken;
      }

      const fallbackStatus = ((): ConnectionStatus => {
        if (!googleManagedStatuses.length) return 'disconnected';
        if (googleManagedStatuses.includes('CONNECTED')) return 'connected';
        if (googleManagedStatuses.includes('PENDING')) return 'connecting';
        if (googleManagedStatuses.includes('ERROR') || googleManagedStatuses.includes('EXPIRED')) return 'error';
        return 'disconnected';
      })();

      return {
        ...connection,
        status: connectedSubCount > 0 ? 'connected' : fallbackStatus,
        score: connectedSubCount > 0 ? Math.max(connection.score || 0, 95) : connection.score,
        subConnections: nextSubConnections,
        settings: nextSettings,
      };
    }

    if (connection.id === 'meta' && meta) {
      const nonArchivedMetaAccounts = (meta.accounts || []).filter((a) => a.status !== 'ARCHIVED');
      const selected = nonArchivedMetaAccounts.find((a) => a.isSelected) || nonArchivedMetaAccounts[0] || null;
      const mappedMetaStatus = mapManagedStatusToLocal(meta.status);
      return {
        ...connection,
        status: mappedMetaStatus,
        score: mappedMetaStatus === 'connected' ? Math.max(connection.score || 0, 95) : connection.score,
        settings: {
          ...(connection.settings || {}),
          metaAdsId: selected?.externalAccountId || '',
          metaToken:
            mappedMetaStatus === 'connected' || mappedMetaStatus === 'connecting'
              ? 'server-managed'
              : '',
        },
      };
    }
    if (connection.id === 'meta' && !meta) {
      return {
        ...connection,
        status: 'disconnected',
        score: undefined,
        settings: { ...(connection.settings || {}), metaAdsId: '', metaToken: '' },
      };
    }

    if (connection.id === 'tiktok' && tiktok) {
      const selected = tiktok.accounts?.find((a) => a.isSelected) || tiktok.accounts?.[0] || null;
      return {
        ...connection,
        status: mapManagedStatusToLocal(tiktok.status),
        score:
          mapManagedStatusToLocal(tiktok.status) === 'connected'
            ? Math.max(connection.score || 0, 95)
            : connection.score,
        settings: {
          ...(connection.settings || {}),
          tiktokAdvertiserId: selected?.externalAccountId || connection.settings?.tiktokAdvertiserId || '',
          tiktokToken: connection.settings?.tiktokToken || (selected ? 'server-managed' : ''),
        },
      };
    }

    return connection;
  });
}
