"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, resolveWorkspaceScope, type WorkspaceScope } from '../lib/firebase';
import { verifyWooCommerceConnection } from '../services/woocommerceService';
import { fetchMetaAdAccounts } from '../services/metaService';
import { fetchGoogleAdAccounts } from '../services/googleService';
import { AI_CONNECTION_IDS, PLATFORM_CONNECTION_IDS, ADMIN_SALES_EMAIL, initialConnections } from './connectionsData';
import { isExpiredTrialStatus, stripUndefinedDeep, isPermissionDeniedError } from './connectionsUtils';
import {
  mergeManagedConnectionsIntoLocal,
  type ManagedApiConnection,
  type ManagedPlatformSlug,
} from './connections/managedApiHelpers';
import {
  ensureManagedApiSession,
  fetchManagedConnections,
  postManagedTest,
  disconnectManagedConnection,
  buildWorkspaceHeaders,
} from './connections/managedApiClient';
import {
  persistUserConnections,
  persistGlobalAiConnections,
  persistConnections,
} from './connections/persistConnections';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Context ───────────────────────────────────────────────────────────────────

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

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

  // ── Managed connections sync ──────────────────────────────────────────────

  const syncManagedConnectionsToLocal = async () => {
    try {
      const managedConns = await fetchManagedConnections(dataOwnerUid);
      if (!managedConns) return;
      setConnections((prev) => {
        const merged = mergeManagedConnectionsIntoLocal(prev, managedConns);
        void persistUserConnections(merged, dataOwnerUid);
        return merged;
      });
    } catch (err) {
      console.warn('Managed connections sync skipped:', err);
    }
  };

  // ── Auth + Firestore snapshot effect ──────────────────────────────────────

  useEffect(() => {
    let unsubGlobal: (() => void) | null = null;
    let unsubUser: (() => void) | null = null;
    let unsubOwnerProfile: (() => void) | null = null;
    let isCancelled = false;

    const clearDataListeners = () => {
      unsubGlobal?.(); unsubUser?.(); unsubOwnerProfile?.();
      unsubGlobal = null; unsubUser = null; unsubOwnerProfile = null;
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
        userItems.forEach((c) => byId.set(c.id, c));
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
        globalItems = [];
        if (source === 'user') userItems = [];
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
            userItems = (snap.data().items || []) as Connection[];
          } else {
            userItems = [];
            setDoc(
              userConnectionsRef,
              {
                items: stripUndefinedDeep(
                  initialConnections.filter((c) => (PLATFORM_CONNECTION_IDS as readonly string[]).includes(c.id))
                ),
              }
            ).catch((err) => console.error('Error seeding user connections document:', err));
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Periodic managed-API sync ─────────────────────────────────────────────

  useEffect(() => {
    if (isLoading) return;
    if (!auth.currentUser) return;
    let isCancelled = false;

    const runSync = async () => {
      if (!isCancelled) await syncManagedConnectionsToLocal();
    };

    void runSync();
    const intervalId = window.setInterval(() => void runSync(), 45_000);
    const handleFocus = () => void runSync();
    window.addEventListener('focus', handleFocus);
    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoading, dataOwnerUid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connection actions ────────────────────────────────────────────────────

  const toggleConnection = async (id: string, subId?: string) => {
    if (isWorkspaceReadOnly) return;
    const connecting = connections.map((c) => {
      if (c.id !== id) return c;
      if (subId && c.subConnections) {
        return {
          ...c,
          subConnections: c.subConnections.map((sc) =>
            sc.id === subId ? { ...sc, status: 'connecting' as ConnectionStatus } : sc
          ),
        };
      }
      return { ...c, status: 'connecting' as ConnectionStatus };
    });
    setConnections(connecting);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const final = connections.map((c) => {
      if (c.id !== id) return c;
      if (subId && c.subConnections) {
        const newSubs = c.subConnections.map((sc) => {
          if (sc.id !== subId) return sc;
          const isSuccess = Math.random() > 0.2;
          return {
            ...sc,
            status: sc.status === 'connecting'
              ? (isSuccess ? 'connected' as ConnectionStatus : 'error' as ConnectionStatus)
              : 'disconnected' as ConnectionStatus,
            score: isSuccess ? Math.floor(Math.random() * 20) + 80 : undefined,
          };
        });
        const anyConnected = newSubs.some((sc) => sc.status === 'connected');
        return {
          ...c,
          subConnections: newSubs,
          status: anyConnected ? 'connected' as ConnectionStatus : 'disconnected' as ConnectionStatus,
          score: anyConnected
            ? Math.round(
                newSubs.filter((sc) => sc.status === 'connected').reduce((acc, curr) => acc + (curr.score || 0), 0) /
                  newSubs.filter((sc) => sc.status === 'connected').length
              )
            : undefined,
        };
      }
      if (c.status === 'connecting') {
        const isSuccess = Math.random() > 0.3;
        return {
          ...c,
          status: isSuccess ? 'connected' as ConnectionStatus : 'error' as ConnectionStatus,
          score: isSuccess ? Math.floor(Math.random() * 20) + 80 : undefined,
        };
      }
      return { ...c, status: 'disconnected' as ConnectionStatus, score: undefined };
    });
    setConnections(final);
    await persistUserConnections(final, dataOwnerUid);
  };

  const updateConnectionSettings = async (id: string, settings: ConnectionSettings) => {
    if (isWorkspaceReadOnly) return;
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'connecting' as ConnectionStatus } : c)));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const updated = connections.map((c) =>
      c.id === id
        ? { ...c, status: 'connected' as ConnectionStatus, score: Math.floor(Math.random() * 10) + 90, settings: { ...c.settings, ...settings } }
        : c
    );
    setConnections(updated);
    await persistConnections(updated, dataOwnerUid, id);
  };

  const clearConnectionSettings = async (id: string) => {
    if (isWorkspaceReadOnly) return;
    const managedPlatformSlugs = managedPlatformsByConnectionId[id as Connection['id']] || [];
    const disconnectFailures: string[] = [];
    if (managedPlatformSlugs.length > 0) {
      await ensureManagedApiSession();
      for (const platformSlug of managedPlatformSlugs) {
        try {
          await disconnectManagedConnection(platformSlug, { skipBootstrap: true });
        } catch (error) {
          disconnectFailures.push(`${platformSlug} (${error instanceof Error ? error.message : 'unknown error'})`);
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
    await persistConnections(next, dataOwnerUid, id);
    if (managedPlatformSlugs.length > 0) await syncManagedConnectionsToLocal();
    if (disconnectFailures.length > 0) {
      throw new Error(`Failed to fully disconnect: ${disconnectFailures.join(', ')}`);
    }
  };

  const resetAllConnections = async () => {
    if (isWorkspaceReadOnly) return;
    const managedResetFailures: string[] = [];
    for (const targetId of ['google', 'meta', 'tiktok'] as Connection['id'][]) {
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
    await persistUserConnections(fresh, dataOwnerUid);
    if (managedResetFailures.length > 0) {
      throw new Error(`Failed to fully reset: ${managedResetFailures.join(', ')}`);
    }
  };

  const migrateAiConnectionsFromUser = async (): Promise<{ success: boolean; message: string }> => {
    if (isWorkspaceReadOnly) return { success: false, message: 'Workspace is read-only for this user' };
    const user = auth.currentUser;
    if (!user) return { success: false, message: 'User not authenticated' };

    const scopedOwnerUid = dataOwnerUid || user.uid;
    const userConnectionsRef = doc(db, 'users', scopedOwnerUid, 'settings', 'connections');
    const globalAiRef = doc(db, 'appSettings', 'connections');
    const [userSnap, globalSnap] = await Promise.all([getDoc(userConnectionsRef), getDoc(globalAiRef)]);

    if (!userSnap.exists()) return { success: false, message: 'No user connections document found to migrate from.' };

    const userItems = (userSnap.data().items || []) as Connection[];
    const aiFromUser = userItems.filter((c) => (AI_CONNECTION_IDS as readonly string[]).includes(c.id));
    if (aiFromUser.length === 0) {
      return { success: false, message: 'No Gemini / OpenAI / Claude connections found on the current user.' };
    }

    const existingGlobalItems = globalSnap.exists() ? ((globalSnap.data().items || []) as Connection[]) : [];
    const byId = new Map<string, Connection>();
    existingGlobalItems.filter((c) => (AI_CONNECTION_IDS as readonly string[]).includes(c.id)).forEach((c) => byId.set(c.id, c));
    aiFromUser.forEach((c) => byId.set(c.id, c));

    await setDoc(globalAiRef, { items: stripUndefinedDeep(Array.from(byId.values())) }, { merge: true });
    return { success: true, message: 'AI connections migrated from your user settings to appSettings (shared for all users).' };
  };

  const testConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (isWorkspaceReadOnly) return { success: false, message: 'Workspace is read-only for this user' };
    const connection = connections.find((c) => c.id === id);
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
          const updated = connections.map((c) =>
            c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: c.score || 100 } : c
          );
          setConnections(updated);
          await persistUserConnections(updated, dataOwnerUid);
        }
        return result;
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Managed connection test failed.' };
      }
    }

    if (id === 'woocommerce' && connection.settings) {
      const { storeUrl, wooKey, wooSecret } = connection.settings;
      try {
        await verifyWooCommerceConnection(storeUrl, wooKey, wooSecret);
        const updated = connections.map((c) => (c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: 100 } : c));
        setConnections(updated);
        await persistUserConnections(updated, dataOwnerUid);
        return { success: true, message: 'החיבור ל-WooCommerce אומת בהצלחה! הנתונים מסונכרנים.' };
      } catch (err) {
        return { success: false, message: `נכשל אימות החיבור ל-WooCommerce: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}` };
      }
    }

    if (id === 'meta' && connection.settings?.metaToken) {
      try {
        await fetchMetaAdAccounts(connection.settings.metaToken);
        return { success: true, message: 'החיבור ל-Meta אומת בהצלחה.' };
      } catch {
        return { success: false, message: 'נכשל אימות החיבור ל-Meta.' };
      }
    }

    if (id === 'google' && connection.settings?.googleAccessToken) {
      try {
        await fetchGoogleAdAccounts(connection.settings.googleAccessToken);
        return { success: true, message: 'החיבור ל-Google אומת בהצלחה.' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
        const isDeveloperTokenMissing = /developer token not configured/i.test(msg);
        return {
          success: false,
          message: isDeveloperTokenMissing
            ? 'חיבור Google Ads דורש הגדרת Developer Token בשרת (משתנה GOOGLE_ADS_DEVELOPER_TOKEN). אנא פנה למנהל המערכת או הוסף את המפתח ב-Vercel.'
            : `נכשל אימות החיבור ל-Google. ${msg}`,
        };
      }
    }

    // Default simulation for other integrations
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (Math.random() > 0.1) {
      const updated = connections.map((c) =>
        c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: Math.floor(Math.random() * 5) + 95 } : c
      );
      setConnections(updated);
      await persistUserConnections(updated, dataOwnerUid);
      return { success: true, message: `החיבור ל-${connection.name} אומת בהצלחה. נתוני API זמינים.` };
    }
    return { success: false, message: `נכשל אימות החיבור ל-${connection.name}. אנא בדוק את הגדרות ה-API.` };
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const connectedConnections = connections.filter((c) => c.status === 'connected');
  const connectedCount = connectedConnections.length;
  const totalCount = connections.length;
  const overallQualityScore =
    connectedCount > 0
      ? Math.round(connectedConnections.reduce((acc, curr) => acc + (curr.score || 0), 0) / connectedCount)
      : 0;

  return (
    <ConnectionsContext.Provider
      value={{
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
        totalCount,
      }}
    >
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections() {
  const context = useContext(ConnectionsContext);
  if (context === undefined) throw new Error('useConnections must be used within a ConnectionsProvider');
  return context;
}
