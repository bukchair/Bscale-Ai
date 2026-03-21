"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, resolveWorkspaceScope, type WorkspaceScope } from '../lib/firebase';
import { verifyWooCommerceConnection } from '../services/woocommerceService';
import { fetchMetaAdAccounts } from '../services/metaService';
import { fetchGoogleAdAccounts } from '../services/googleService';
import { AI_CONNECTION_IDS, PLATFORM_CONNECTION_IDS, ADMIN_SALES_EMAIL, initialConnections } from './connectionsData';
import { isValidDateValue, isExpiredTrialStatus, stripUndefinedDeep, isPermissionDeniedError } from './connectionsUtils';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface SubConnection {
  id: string;
  name: string;
  status: ConnectionStatus;
  score?: number;
}

export interface ConnectionSettings {
  [key: string]: string;
}

export interface Connection {
  id: string;
  name: string;
  category: string;
  status: ConnectionStatus;
  score?: number;
  description: string;
  subConnections?: SubConnection[];
  settings?: ConnectionSettings;
}

interface ConnectionsContextType {
  connections: Connection[];
  dataOwnerUid: string | null;
  dataAccessMode: 'owner' | 'shared';
  workspaceOwnerName: string | null;
  workspaceOwnerEmail: string | null;
  sharedRole: 'manager' | 'viewer' | null;
  isWorkspaceReadOnly: boolean;
  toggleConnection: (id: string, subId?: string) => Promise<void>;
  updateConnectionSettings: (id: string, settings: ConnectionSettings) => Promise<void>;
  clearConnectionSettings: (id: string) => Promise<void>;
  resetAllConnections: () => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  overallQualityScore: number;
  connectedCount: number;
  totalCount: number;
  migrateAiConnectionsFromUser: () => Promise<{ success: boolean; message: string }>;
}

type ManagedApiConnection = {
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
type ManagedPlatformSlug =
  | 'google-ads'
  | 'ga4'
  | 'search-console'
  | 'gmail'
  | 'meta'
  | 'tiktok';

// AI connections are stored in appSettings/connections and shared with all users (read by everyone, write by admin only).

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [isLoading, setIsLoading] = useState(true);
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(null);
  const [dataAccessMode, setDataAccessMode] = useState<'owner' | 'shared'>('owner');
  const [workspaceOwnerName, setWorkspaceOwnerName] = useState<string | null>(null);
  const [workspaceOwnerEmail, setWorkspaceOwnerEmail] = useState<string | null>(null);
  const [sharedRole, setSharedRole] = useState<'manager' | 'viewer' | null>(null);
  const isWorkspaceReadOnly = dataAccessMode === 'shared' && sharedRole === 'viewer';
  const managedPlatformsByConnectionId: Partial<Record<Connection['id'], ManagedPlatformSlug[]>> = {
    google: ['google-ads', 'ga4', 'search-console', 'gmail'],
    meta: ['meta'],
    tiktok: ['tiktok'],
  };

  const waitForCurrentUser = async () => {
    if (auth.currentUser) return auth.currentUser;
    return new Promise<import('firebase/auth').User | null>((resolve) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(auth.currentUser);
      }, 2500);
      const unsubscribe = auth.onAuthStateChanged((nextUser) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        unsubscribe();
        resolve(nextUser);
      });
    });
  };

  // Returns the X-Owner-UID header when the current user is operating in a shared workspace.
  const getWorkspaceHeaders = (): Record<string, string> => {
    const currentUid = auth.currentUser?.uid;
    if (dataOwnerUid && currentUid && dataOwnerUid !== currentUid) {
      return { 'X-Owner-UID': dataOwnerUid };
    }
    return {};
  };

  const ensureManagedApiSession = async () => {
    // If session cookie already exists and is valid, skip bootstrap.
    const sessionCheck = await fetch('/api/connections', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });
    if (sessionCheck.ok) return;

    const user = await waitForCurrentUser();
    if (!user) {
      throw new Error('Missing sign-in session. Please refresh and sign in again.');
    }

    const idToken = await user.getIdToken(true);
    const response = await fetch('/api/auth/session/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to initialize managed API session.');
    }
  };

  const parseManagedPayload = (raw: string) => {
    try {
      return raw ? (JSON.parse(raw) as { success?: boolean; message?: string; errorCode?: string; data?: { connections?: unknown; accounts?: unknown } }) : null;
    } catch {
      return null;
    }
  };

  const mapManagedStatusToLocal = (
    status: ManagedApiConnection['status'] | undefined
  ): ConnectionStatus => {
    if (status === 'CONNECTED') return 'connected';
    if (status === 'PENDING') return 'connecting';
    if (status === 'ERROR' || status === 'EXPIRED') return 'error';
    return 'disconnected';
  };

  const formatGoogleAdsAccountId = (value: string | undefined): string => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 10) return digits;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const normalizeGa4PropertyId = (value: string | undefined): string => {
    const trimmed = String(value || '').trim().replace(/^properties\//i, '');
    return /^\d+$/.test(trimmed) ? trimmed : '';
  };

  const mergeManagedConnectionsIntoLocal = (
    current: Connection[],
    managedConnections: ManagedApiConnection[]
  ): Connection[] => {
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
            if (sub.id === 'google_ads') {
              return { ...sub, status: mapManagedStatusToLocal(ads?.status) };
            }
            if (sub.id === 'ga4') {
              return { ...sub, status: mapManagedStatusToLocal(ga4?.status) };
            }
            if (sub.id === 'gsc') {
              return { ...sub, status: mapManagedStatusToLocal(gsc?.status) };
            }
            if (sub.id === 'gmail') {
              return { ...sub, status: mapManagedStatusToLocal(gmail?.status) };
            }
            return sub;
          }) || connection.subConnections;

        const nonArchived = (accounts?: ManagedApiConnection['accounts']) =>
          (accounts || []).filter((account) => account.status !== 'ARCHIVED');
        const adsAccounts = nonArchived(ads?.accounts);
        const ga4Accounts = nonArchived(ga4?.accounts);
        const gscAccounts = nonArchived(gsc?.accounts);
        const gmailAccounts = nonArchived(gmail?.accounts);
        const selectedAdsAccount =
          adsAccounts.find((account) => account.isSelected) || adsAccounts[0] || null;
        const selectedGa4 =
          ga4Accounts.find((account) => account.isSelected) || ga4Accounts[0] || null;
        const selectedGsc =
          gscAccounts.find((account) => account.isSelected) || gscAccounts[0] || null;
        const selectedGmail =
          gmailAccounts.find((account) => account.isSelected) || gmailAccounts[0] || null;
        const connectedSubCount = (nextSubConnections || []).filter((sub) => sub.status === 'connected').length;
        const googleManagedStatuses = [ads?.status, ga4?.status, gsc?.status, gmail?.status].filter(
          (value): value is ManagedApiConnection['status'] => Boolean(value)
        );

        const nextSettings: ConnectionSettings = {
          ...(connection.settings || {}),
        };

        if (selectedAdsAccount?.externalAccountId) {
          nextSettings.googleAdsId = formatGoogleAdsAccountId(selectedAdsAccount.externalAccountId);
        }
        const selectedGa4PropertyId = normalizeGa4PropertyId(selectedGa4?.externalAccountId);
        if (selectedGa4PropertyId) {
          nextSettings.ga4Id = selectedGa4PropertyId;
        } else if (nextSettings.ga4Id) {
          // Keep only numeric GA4 Property IDs in settings to avoid G-Measurement IDs.
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
        if (googleManagedStatuses.some((status) => status === 'CONNECTED' || status === 'PENDING')) {
          nextSettings.googleAccessToken = 'server-managed';
        } else {
          delete nextSettings.googleAccessToken;
        }

        const fallbackStatus = (() => {
          if (!googleManagedStatuses.length) return 'disconnected' as ConnectionStatus;
          if (googleManagedStatuses.includes('CONNECTED')) return 'connected' as ConnectionStatus;
          if (googleManagedStatuses.includes('PENDING')) return 'connecting' as ConnectionStatus;
          if (googleManagedStatuses.includes('ERROR') || googleManagedStatuses.includes('EXPIRED')) {
            return 'error' as ConnectionStatus;
          }
          return 'disconnected' as ConnectionStatus;
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
        const nonArchivedMetaAccounts = (meta.accounts || []).filter(
          (account) => account.status !== 'ARCHIVED'
        );
        const selected =
          nonArchivedMetaAccounts.find((account) => account.isSelected) ||
          nonArchivedMetaAccounts[0] ||
          null;
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
          settings: {
            ...(connection.settings || {}),
            metaAdsId: '',
            metaToken: '',
          },
        };
      }

      if (connection.id === 'tiktok' && tiktok) {
        const selected =
          tiktok.accounts?.find((account) => account.isSelected) || tiktok.accounts?.[0] || null;
        return {
          ...connection,
          status: mapManagedStatusToLocal(tiktok.status),
          score:
            mapManagedStatusToLocal(tiktok.status) === 'connected'
              ? Math.max(connection.score || 0, 95)
              : connection.score,
          settings: {
            ...(connection.settings || {}),
            tiktokAdvertiserId:
              selected?.externalAccountId || connection.settings?.tiktokAdvertiserId || '',
            tiktokToken: connection.settings?.tiktokToken || (selected ? 'server-managed' : ''),
          },
        };
      }

      return connection;
    });
  };

  const fetchManagedConnections = async (): Promise<ManagedApiConnection[] | null> => {
    await ensureManagedApiSession();
    const response = await fetch('/api/connections', { method: 'GET', cache: 'no-store', headers: getWorkspaceHeaders() });
    const text = await response.text();
    const payload = parseManagedPayload(text);
    if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.connections)) {
      return null;
    }
    return payload.data.connections as ManagedApiConnection[];
  };

  const autoDiscoverAndSelectManagedAccounts = async (
    platformSlug: 'google-ads' | 'meta' | 'tiktok'
  ): Promise<void> => {
    await ensureManagedApiSession();
    const discoverResponse = await fetch(`/api/connections/${platformSlug}/accounts`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
    });
    const discoverText = await discoverResponse.text();
    const discoverPayload = parseManagedPayload(discoverText);

    if (!discoverResponse.ok || !discoverPayload?.success) {
      return;
    }

    const accounts = Array.isArray(discoverPayload.data?.accounts) ? discoverPayload.data.accounts : [];
    const accountIds = accounts
      .map((account: { externalAccountId?: string }) => String(account.externalAccountId || '').trim())
      .filter(Boolean);

    if (!accountIds.length) return;

    await fetch(`/api/connections/${platformSlug}/select-accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountIds }),
      credentials: 'include',
    });
  };

  const postManagedTest = async (
    platformSlug: 'google-ads' | 'meta' | 'tiktok',
    accountId?: string
  ): Promise<{ success: boolean; message: string }> => {
    await ensureManagedApiSession();
    await autoDiscoverAndSelectManagedAccounts(platformSlug);

    const response = await fetch(`/api/connections/${platformSlug}/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId }),
      credentials: 'include',
    });

    const text = await response.text();
    const payload = parseManagedPayload(text);

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        message: payload?.message || `Managed test failed (${response.status}).`,
      };
    }

    return {
      success: true,
      message: payload.message || 'Connection test succeeded.',
    };
  };

  const disconnectManagedConnection = async (
    platformSlug: ManagedPlatformSlug,
    options?: { skipBootstrap?: boolean }
  ): Promise<void> => {
    if (!options?.skipBootstrap) {
      await ensureManagedApiSession();
    }

    const runDisconnectRequest = async () => {
      let response = await fetch(`/api/connections/${platformSlug}/disconnect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      // Defensive fallback for edge proxy/method rewrite issues.
      if (response.status === 405) {
        response = await fetch(`/api/connections/${platformSlug}/disconnect`, {
          method: 'GET',
          headers: { accept: 'application/json' },
          cache: 'no-store',
          credentials: 'include',
        });
      }

      const text = await response.text();
      const payload = parseManagedPayload(text);
      return { response, payload, text };
    };

    let { response, payload, text } = await runDisconnectRequest();

    // Session may expire between calls; retry once after re-bootstrap.
    if (response.status === 401 || response.status === 403) {
      await ensureManagedApiSession();
      ({ response, payload, text } = await runDisconnectRequest());
    }

    if (!response.ok || !payload?.success) {
      const fallbackMessage = text ? text.slice(0, 180) : `Failed to disconnect ${platformSlug}.`;
      throw new Error(payload?.message || fallbackMessage || `Failed to disconnect ${platformSlug}.`);
    }
  };

  const syncManagedConnectionsToLocal = async () => {
    try {
      const managedConnections = await fetchManagedConnections();
      if (!managedConnections) return;
      setConnections((prev) => {
        const merged = mergeManagedConnectionsIntoLocal(prev, managedConnections);
        void persistUserConnections(merged);
        return merged;
      });
    } catch (err) {
      console.warn('Managed connections sync skipped:', err);
    }
  };

  useEffect(() => {
    let unsubGlobal: (() => void) | null = null;
    let unsubUser: (() => void) | null = null;
    let unsubOwnerProfile: (() => void) | null = null;
    let isCancelled = false;

    const clearDataListeners = () => {
      if (unsubGlobal) unsubGlobal();
      if (unsubUser) unsubUser();
      if (unsubOwnerProfile) unsubOwnerProfile();
      unsubGlobal = null;
      unsubUser = null;
      unsubOwnerProfile = null;
    };

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      clearDataListeners();
      if (!user) {
        setConnections(initialConnections);
        setDataOwnerUid(null);
        setDataAccessMode('owner');
        setWorkspaceOwnerName(null);
        setWorkspaceOwnerEmail(null);
        setSharedRole(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      let scope: WorkspaceScope | null = null;
      try {
        scope = await resolveWorkspaceScope({ uid: user.uid, email: user.email });
      } catch (err) {
        console.error('Failed to resolve workspace scope, falling back to own workspace:', err);
      }
      if (isCancelled) return;

      const scopedOwnerUid = scope?.ownerUid || user.uid;
      setDataOwnerUid(scopedOwnerUid);
      setDataAccessMode(scope?.accessMode || 'owner');
      setWorkspaceOwnerName(scope?.ownerName || null);
      setWorkspaceOwnerEmail(scope?.ownerEmail || null);
      setSharedRole(scope?.sharedRole || null);

      const userConnectionsRef = doc(db, 'users', scopedOwnerUid, 'settings', 'connections');
      const globalAiRef = doc(db, 'appSettings', 'connections');
      const ownerProfileRef = doc(db, 'users', scopedOwnerUid);

      let globalItems: Connection[] = [];
      let userItems: Connection[] = [];
      let restrictPlatformsToDemo = false;
      let allowGlobalAiRead = false;

      const shouldRestrictPlatformsToDemo = (ownerData: Record<string, unknown> | undefined) => {
        if (!ownerData) return false;
        const ownerRole = ownerData.role;
        const ownerEmail = typeof ownerData.email === 'string' ? ownerData.email.toLowerCase() : '';
        const ownerIsAdmin = ownerRole === 'admin' || ownerEmail === ADMIN_SALES_EMAIL;
        if (ownerIsAdmin) return false;
        return ownerData.subscriptionStatus === 'demo' || isExpiredTrialStatus(ownerData);
      };

      const applyPlanRestrictions = (items: Connection[]) => {
        if (!restrictPlatformsToDemo) return items;
        return items.map((connection) => {
          if (!(PLATFORM_CONNECTION_IDS as readonly string[]).includes(connection.id)) return connection;
          return {
            ...connection,
            status: 'disconnected' as ConnectionStatus,
            score: undefined,
            subConnections: connection.subConnections?.map((sub) => ({
              ...sub,
              status: 'disconnected' as ConnectionStatus,
              score: undefined,
            })),
          };
        });
      };

      const mergeAndSet = () => {
        const byId = new Map<string, Connection>(initialConnections.map((c) => [c.id, { ...c }]));
        // קודם כל נתוני המשתמש (כולל AI אם קיימים)
        userItems.forEach((c) => byId.set(c.id, c));
        // ואז נתוני ה-AI הגלובליים גוברים על נתוני המשתמש לאותם מזהים
        globalItems.forEach((c) => byId.set(c.id, c));
        setConnections(applyPlanRestrictions(Array.from(byId.values())));
      };

      try {
        const ownerSnap = await getDoc(ownerProfileRef);
        if (ownerSnap.exists()) {
          const ownerData = ownerSnap.data() as Record<string, unknown>;
          restrictPlatformsToDemo = shouldRestrictPlatformsToDemo(ownerData);
          const ownerEmail = String(ownerData.email || '').toLowerCase();
          allowGlobalAiRead = ownerData.role === 'admin' || ownerEmail === ADMIN_SALES_EMAIL;
        }
      } catch (err) {
        console.warn('Failed reading owner subscription mode for connection restrictions:', err);
      }
      if (isCancelled) return;

      unsubOwnerProfile = onSnapshot(
        ownerProfileRef,
        (snap) => {
          const ownerData = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
          restrictPlatformsToDemo = shouldRestrictPlatformsToDemo(ownerData);
          const ownerEmail = String(ownerData?.email || '').toLowerCase();
          allowGlobalAiRead = ownerData?.role === 'admin' || ownerEmail === ADMIN_SALES_EMAIL;
          mergeAndSet();
        },
        (err) => {
          console.warn('Owner subscription snapshot failed, keeping existing restriction mode:', err);
        }
      );

      const handleSnapshotError = (source: 'global' | 'user') => (err: unknown) => {
        const permissionDenied = isPermissionDeniedError(err);
        if (!permissionDenied) {
          console.error(`Error in ${source} connections snapshot:`, err);
        } else {
          console.warn(`Permission denied reading ${source} connections; falling back to local data.`);
        }
        // אם אין הרשאות לקרוא את המסמכים - נישאר על נתוני דמו ולא נפיל את האפליקציה
        globalItems = [];
        if (source === 'user') {
          userItems = [];
        }
        if (source === 'global' && permissionDenied && unsubGlobal) {
          unsubGlobal();
          unsubGlobal = null;
        }
        mergeAndSet();
        setIsLoading(false);
      };

      if (allowGlobalAiRead) {
        unsubGlobal = onSnapshot(
          globalAiRef,
          (snap) => {
            if (snap.exists()) {
              const items = (snap.data().items || []) as Connection[];
              globalItems = items.filter((c) => (AI_CONNECTION_IDS as readonly string[]).includes(c.id));
            } else {
              globalItems = [];
            }
            mergeAndSet();
            setIsLoading(false);
          },
          handleSnapshotError('global')
        );
      } else {
        globalItems = [];
      }

      unsubUser = onSnapshot(
        userConnectionsRef,
        (snap) => {
          if (snap.exists()) {
            const items = (snap.data().items || []) as Connection[];
            // שומרים גם AI וגם פלטפורמות במסמך המשתמש - AI ישמש כגיבוי אם אין גישה למסמך הגלובלי
            userItems = items;
          } else {
            userItems = [];
            // אל תנסה ליצור מסמך אם אין הרשאות - זה ייכשל ברמת השרת
            setDoc(
              userConnectionsRef,
              {
                items: stripUndefinedDeep(
                  initialConnections.filter((c) => (PLATFORM_CONNECTION_IDS as readonly string[]).includes(c.id))
                ),
              }
            ).catch((err) => {
              console.error('Error seeding user connections document:', err);
            });
          }
          mergeAndSet();
          setIsLoading(false);
        },
        handleSnapshotError('user')
      );

    });

    return () => {
      isCancelled = true;
      clearDataListeners();
      unsubscribeAuth();
    };
  }, []);

  const persistUserConnections = async (items: Connection[]) => {
    const user = auth.currentUser;
    if (!user) return;
    const scopedOwnerUid = dataOwnerUid || user.uid;
    const ref = doc(db, 'users', scopedOwnerUid, 'settings', 'connections');
    try {
      await setDoc(ref, { items: stripUndefinedDeep(items) }, { merge: true });
    } catch (err) {
      console.error('Error persisting user connections:', err);
    }
  };

  const persistGlobalAiConnections = async (items: Connection[]) => {
    const ref = doc(db, 'appSettings', 'connections');
    const aiOnly = items.filter((c) => (AI_CONNECTION_IDS as readonly string[]).includes(c.id));
    try {
      await setDoc(ref, { items: stripUndefinedDeep(aiOnly) }, { merge: true });
    } catch (err) {
      console.error('Error persisting global AI connections:', err);
    }
  };

  const persistConnections = async (newConnections: Connection[], updatedId?: string) => {
    // תמיד שומרים במסמך המשתמש (כולל AI) כדי שהאדמין יראה את ההגדרות מיד
    await persistUserConnections(newConnections);
    // ואם מדובר בחיבור AI – גם במסמך הגלובלי המשותף
    if (updatedId && (AI_CONNECTION_IDS as readonly string[]).includes(updatedId)) {
      await persistGlobalAiConnections(newConnections);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!auth.currentUser) return;
    let isCancelled = false;

    const runSync = async () => {
      if (isCancelled) return;
      await syncManagedConnectionsToLocal();
    };

    void runSync();

    const intervalId = window.setInterval(() => {
      void runSync();
    }, 45_000);

    const handleFocus = () => {
      void runSync();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoading, dataOwnerUid]);

  const toggleConnection = async (id: string, subId?: string) => {
    if (isWorkspaceReadOnly) return;
    const newConnections = connections.map(c => {
      if (c.id === id) {
        if (subId && c.subConnections) {
          return {
            ...c,
            subConnections: c.subConnections.map(sc => 
              sc.id === subId ? { ...sc, status: 'connecting' as ConnectionStatus } : sc
            )
          };
        }
        return { ...c, status: 'connecting' as ConnectionStatus };
      }
      return c;
    });
    
    setConnections(newConnections);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const finalConnections = connections.map(c => {
      if (c.id === id) {
        if (subId && c.subConnections) {
          const newSubConnections = c.subConnections.map(sc => {
            if (sc.id === subId) {
              const isSuccess = Math.random() > 0.2;
              return {
                ...sc,
                status: sc.status === 'connecting' ? (isSuccess ? 'connected' as ConnectionStatus : 'error' as ConnectionStatus) : 'disconnected' as ConnectionStatus,
                score: isSuccess ? Math.floor(Math.random() * 20) + 80 : undefined
              };
            }
            return sc;
          });
          
          const anyConnected = newSubConnections.some(sc => sc.status === 'connected');
          const allConnected = newSubConnections.every(sc => sc.status === 'connected');
          
          return {
            ...c,
            subConnections: newSubConnections,
            status: allConnected ? 'connected' as ConnectionStatus : (anyConnected ? 'connected' as ConnectionStatus : 'disconnected' as ConnectionStatus),
            score: anyConnected ? Math.round(newSubConnections.filter(sc => sc.status === 'connected').reduce((acc, curr) => acc + (curr.score || 0), 0) / newSubConnections.filter(sc => sc.status === 'connected').length) : undefined
          };
        }

        if (c.status === 'connecting') {
          const isSuccess = Math.random() > 0.3;
          return { 
            ...c, 
            status: isSuccess ? 'connected' as ConnectionStatus : 'error' as ConnectionStatus,
            score: isSuccess ? Math.floor(Math.random() * 20) + 80 : undefined
          };
        } else {
          return { ...c, status: 'disconnected' as ConnectionStatus, score: undefined };
        }
      }
      return c;
    });

    setConnections(finalConnections);
    await persistUserConnections(finalConnections);
  };

  const updateConnectionSettings = async (id: string, settings: ConnectionSettings) => {
    if (isWorkspaceReadOnly) return;
    const connectingConnections = connections.map(c => {
      if (c.id === id) {
        return { ...c, status: 'connecting' as ConnectionStatus };
      }
      return c;
    });
    
    setConnections(connectingConnections);
    
    // Simulate API validation
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalConnections = connections.map(c => {
      if (c.id === id) {
        return { 
          ...c, 
          status: 'connected' as ConnectionStatus,
          score: Math.floor(Math.random() * 10) + 90,
          settings: { ...c.settings, ...settings }
        };
      }
      return c;
    });

    setConnections(finalConnections);
    await persistConnections(finalConnections, id);
  };

  const clearConnectionSettings = async (id: string) => {
    if (isWorkspaceReadOnly) return;
    const managedPlatformSlugs = managedPlatformsByConnectionId[id as Connection['id']] || [];
    let disconnectFailures: string[] = [];
    if (managedPlatformSlugs.length > 0) {
      await ensureManagedApiSession();
      for (const platformSlug of managedPlatformSlugs) {
        try {
          await disconnectManagedConnection(platformSlug, { skipBootstrap: true });
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'unknown error';
          disconnectFailures.push(`${platformSlug} (${reason})`);
        }
      }
    }

    const next = connections.map((c) =>
      c.id === id
        ? {
            ...c,
            status: 'disconnected' as ConnectionStatus,
            score: undefined,
            settings: {},
            subConnections: c.subConnections?.map((sub) => ({
              ...sub,
              status: 'disconnected' as ConnectionStatus,
              score: undefined,
            })),
          }
        : c
    );
    setConnections(next);
    await persistConnections(next, id);
    if (managedPlatformSlugs.length > 0) {
      await syncManagedConnectionsToLocal();
    }
    if (disconnectFailures.length > 0) {
      throw new Error(`Failed to fully disconnect: ${disconnectFailures.join(', ')}`);
    }
  };

  const resetAllConnections = async () => {
    if (isWorkspaceReadOnly) return;
    const managedResetTargets: Connection['id'][] = ['google', 'meta', 'tiktok'];
    const managedResetFailures: string[] = [];
    for (const targetId of managedResetTargets) {
      try {
        await clearConnectionSettings(targetId);
      } catch {
        managedResetFailures.push(targetId);
      }
    }

    const aiPart = connections.filter((c) => (AI_CONNECTION_IDS as readonly string[]).includes(c.id));
    const platformPart = initialConnections.filter((c) => (PLATFORM_CONNECTION_IDS as readonly string[]).includes(c.id));
    const fresh = [...aiPart, ...platformPart];
    setConnections(fresh);
    await persistUserConnections(fresh);
    if (managedResetFailures.length > 0) {
      throw new Error(`Failed to fully reset: ${managedResetFailures.join(', ')}`);
    }
  };

  const migrateAiConnectionsFromUser = async (): Promise<{ success: boolean; message: string }> => {
    if (isWorkspaceReadOnly) {
      return { success: false, message: 'Workspace is read-only for this user' };
    }
    const user = auth.currentUser;
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    const scopedOwnerUid = dataOwnerUid || user.uid;
    const userConnectionsRef = doc(db, 'users', scopedOwnerUid, 'settings', 'connections');
    const globalAiRef = doc(db, 'appSettings', 'connections');

    const [userSnap, globalSnap] = await Promise.all([getDoc(userConnectionsRef), getDoc(globalAiRef)]);

    if (!userSnap.exists()) {
      return { success: false, message: 'No user connections document found to migrate from.' };
    }

    const userItems = (userSnap.data().items || []) as Connection[];
    const aiFromUser = userItems.filter((c) => (AI_CONNECTION_IDS as readonly string[]).includes(c.id));

    if (aiFromUser.length === 0) {
      return { success: false, message: 'No Gemini / OpenAI / Claude connections found on the current user.' };
    }

    const existingGlobalItems = globalSnap.exists() ? ((globalSnap.data().items || []) as Connection[]) : [];
    const byId = new Map<string, Connection>();
    existingGlobalItems.forEach((c) => {
      if ((AI_CONNECTION_IDS as readonly string[]).includes(c.id)) {
        byId.set(c.id, c);
      }
    });
    aiFromUser.forEach((c) => {
      byId.set(c.id, c);
    });

    const merged = Array.from(byId.values());
    await setDoc(globalAiRef, { items: stripUndefinedDeep(merged) }, { merge: true });

    return { success: true, message: 'AI connections migrated from your user settings to appSettings (shared for all users).' };
  };

  const testConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (isWorkspaceReadOnly) {
      return { success: false, message: 'Workspace is read-only for this user' };
    }
    const connection = connections.find(c => c.id === id);
    if (!connection) return { success: false, message: 'חיבור לא נמצא' };

    const managedPlatformSlug =
      id === 'google' ? 'google-ads' : id === 'meta' ? 'meta' : id === 'tiktok' ? 'tiktok' : undefined;
    if (managedPlatformSlug) {
      try {
        const fallbackAccountId =
          id === 'google' && connection.settings?.googleAdsId
            ? connection.settings.googleAdsId.replace(/-/g, '').trim()
            : id === 'tiktok' && connection.settings?.tiktokAdvertiserId
            ? String(connection.settings.tiktokAdvertiserId).trim()
            : undefined;
        const result = await postManagedTest(managedPlatformSlug, fallbackAccountId);
        await syncManagedConnectionsToLocal();
        if (result.success) {
          const updatedConnections = connections.map((c) =>
            c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: c.score || 100 } : c
          );
          setConnections(updatedConnections);
          await persistUserConnections(updatedConnections);
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Managed connection test failed.';
        return { success: false, message: msg };
      }
    }

    // Special logic for WooCommerce real verification
    if (id === 'woocommerce' && connection.settings) {
      const { storeUrl, wooKey, wooSecret } = connection.settings;
      try {
        await verifyWooCommerceConnection(storeUrl, wooKey, wooSecret);
        const updatedConnections = connections.map(c => 
          c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: 100 } : c
        );
        setConnections(updatedConnections);
        await persistUserConnections(updatedConnections);
        return { 
          success: true, 
          message: `החיבור ל-WooCommerce אומת בהצלחה! הנתונים מסונכרנים.` 
        };
      } catch (err) {
        console.error("WooCommerce real test failed:", err);
        return { 
          success: false, 
          message: `נכשל אימות החיבור ל-WooCommerce: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}` 
        };
      }
    }

    // Special logic for Meta real verification
    if (id === 'meta' && connection.settings?.metaToken) {
      try {
        await fetchMetaAdAccounts(connection.settings.metaToken);
        return { success: true, message: 'החיבור ל-Meta אומת בהצלחה.' };
      } catch (err) {
        return { success: false, message: 'נכשל אימות החיבור ל-Meta.' };
      }
    }

    // Special logic for Google real verification
    if (id === 'google' && connection.settings?.googleAccessToken) {
      try {
        await fetchGoogleAdAccounts(connection.settings.googleAccessToken);
        return { success: true, message: 'החיבור ל-Google אומת בהצלחה.' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
        const isDeveloperTokenMissing = /developer token not configured/i.test(msg);
        const displayMsg = isDeveloperTokenMissing
          ? 'חיבור Google Ads דורש הגדרת Developer Token בשרת (משתנה GOOGLE_ADS_DEVELOPER_TOKEN). אנא פנה למנהל המערכת או הוסף את המפתח ב-Vercel.'
          : `נכשל אימות החיבור ל-Google. ${msg}`;
        return { success: false, message: displayMsg };
      }
    }

    // Default simulation for other integrations
    await new Promise(resolve => setTimeout(resolve, 2000));
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      const updatedConnections = connections.map(c => 
        c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: Math.floor(Math.random() * 5) + 95 } : c
      );
      setConnections(updatedConnections);
      await persistUserConnections(updatedConnections);
      return { 
        success: true, 
        message: `החיבור ל-${connection.name} אומת בהצלחה. נתוני API זמינים.` 
      };
    } else {
      return { 
        success: false, 
        message: `נכשל אימות החיבור ל-${connection.name}. אנא בדוק את הגדרות ה-API.` 
      };
    }
  };

  const connectedConnections = connections.filter(c => c.status === 'connected');
  const connectedCount = connectedConnections.length;
  const totalCount = connections.length;
  
  const overallQualityScore = connectedCount > 0 
    ? Math.round(connectedConnections.reduce((acc, curr) => acc + (curr.score || 0), 0) / connectedCount)
    : 0;

  return (
    <ConnectionsContext.Provider value={{ 
      connections,
      dataOwnerUid,
      dataAccessMode,
      workspaceOwnerName,
      workspaceOwnerEmail,
      sharedRole,
      isWorkspaceReadOnly,
      toggleConnection, 
      updateConnectionSettings,
      clearConnectionSettings,
      resetAllConnections,
      testConnection,
      migrateAiConnectionsFromUser,
      overallQualityScore, 
      connectedCount, 
      totalCount 
    }}>
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections() {
  const context = useContext(ConnectionsContext);
  if (context === undefined) {
    throw new Error('useConnections must be used within a ConnectionsProvider');
  }
  return context;
}
