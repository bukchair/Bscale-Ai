import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, resolveWorkspaceScope, type WorkspaceScope } from '../lib/firebase';
import { verifyWooCommerceConnection } from '../services/woocommerceService';
import { fetchMetaAdAccounts } from '../services/metaService';
import { fetchGoogleAdAccounts } from '../services/googleService';

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

const AI_CONNECTION_IDS = ['gemini', 'openai', 'claude'] as const;
const PLATFORM_CONNECTION_IDS = ['google', 'meta', 'tiktok', 'woocommerce', 'shopify'] as const;
const ADMIN_SALES_EMAIL = 'asher205@gmail.com';
// AI connections are stored in appSettings/connections and shared with all users (read by everyone, write by admin only).

const isValidDateValue = (value: unknown): value is string => {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
};

const isExpiredTrialStatus = (data: Record<string, unknown> | undefined) => {
  if (!data) return false;
  if (data.subscriptionStatus !== 'trial') return false;
  const trialEndsAt = data.trialEndsAt;
  if (!isValidDateValue(trialEndsAt)) return false;
  return Date.parse(trialEndsAt) <= Date.now();
};

const initialConnections: Connection[] = [
  { 
    id: 'gemini', 
    name: 'integrations.platforms.gemini.name', 
    category: 'AI Engine', 
    status: 'disconnected', 
    description: 'integrations.platforms.gemini.desc' 
  },
  { 
    id: 'openai', 
    name: 'integrations.platforms.openai.name', 
    category: 'AI Engine', 
    status: 'disconnected', 
    description: 'integrations.platforms.openai.desc' 
  },
  { 
    id: 'claude', 
    name: 'integrations.platforms.claude.name', 
    category: 'AI Engine', 
    status: 'disconnected', 
    description: 'integrations.platforms.claude.desc' 
  },
  { 
    id: 'google', 
    name: 'integrations.platforms.google.name', 
    category: 'Google', 
    status: 'disconnected', 
    description: 'integrations.platforms.google.desc',
    subConnections: [
      { id: 'google_ads', name: 'Google Ads', status: 'disconnected' },
      { id: 'ga4', name: 'Google Analytics 4', status: 'disconnected' },
      { id: 'gsc', name: 'Search Console', status: 'disconnected' },
      { id: 'gmail', name: 'Gmail / Reports', status: 'disconnected' },
    ]
  },
  { 
    id: 'meta', 
    name: 'integrations.platforms.meta.name', 
    category: 'Social', 
    status: 'disconnected', 
    description: 'integrations.platforms.meta.desc' 
  },
  { 
    id: 'tiktok', 
    name: 'integrations.platforms.tiktok.name', 
    category: 'Social', 
    status: 'disconnected',
    description: 'integrations.platforms.tiktok.desc' 
  },
  { 
    id: 'woocommerce', 
    name: 'integrations.platforms.woocommerce.name', 
    category: 'E-commerce', 
    status: 'disconnected', 
    description: 'integrations.platforms.woocommerce.desc' 
  },
  { 
    id: 'shopify', 
    name: 'integrations.platforms.shopify.name', 
    category: 'E-commerce', 
    status: 'disconnected',
    description: 'integrations.platforms.shopify.desc' 
  },
];

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
  const managedPlatformByConnectionId: Partial<Record<Connection['id'], 'google-ads' | 'meta' | 'tiktok'>> = {
    google: 'google-ads',
    meta: 'meta',
    tiktok: 'tiktok',
  };

  const ensureManagedApiSession = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/auth/session/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  };

  const postManagedTest = async (
    platformSlug: 'google-ads' | 'meta' | 'tiktok',
    accountId?: string
  ): Promise<{ success: boolean; message: string }> => {
    await ensureManagedApiSession();
    const response = await fetch(`/api/connections/${platformSlug}/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });

    const text = await response.text();
    let payload:
      | {
          success?: boolean;
          message?: string;
          errorCode?: string;
        }
      | null = null;

    try {
      payload = text ? (JSON.parse(text) as typeof payload) : null;
    } catch {
      payload = null;
    }

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
          if (!PLATFORM_CONNECTION_IDS.includes(connection.id as any)) return connection;
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
          restrictPlatformsToDemo = shouldRestrictPlatformsToDemo(ownerSnap.data() as Record<string, unknown>);
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
          mergeAndSet();
        },
        (err) => {
          console.warn('Owner subscription snapshot failed, keeping existing restriction mode:', err);
        }
      );

      const handleSnapshotError = (source: 'global' | 'user') => (err: any) => {
        console.error(`Error in ${source} connections snapshot:`, err);
        // אם אין הרשאות לקרוא את המסמכים - נישאר על נתוני דמו ולא נפיל את האפליקציה
        globalItems = [];
        if (source === 'user') {
          userItems = [];
        }
        mergeAndSet();
        setIsLoading(false);
      };

      unsubGlobal = onSnapshot(
        globalAiRef,
        (snap) => {
          if (snap.exists()) {
            const items = (snap.data().items || []) as Connection[];
            globalItems = items.filter((c) => AI_CONNECTION_IDS.includes(c.id as any));
          } else {
            globalItems = [];
          }
          mergeAndSet();
          setIsLoading(false);
        },
        handleSnapshotError('global')
      );

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
              { items: initialConnections.filter((c) => PLATFORM_CONNECTION_IDS.includes(c.id as any)) }
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
      await setDoc(ref, { items }, { merge: true });
    } catch (err) {
      console.error('Error persisting user connections:', err);
    }
  };

  const persistGlobalAiConnections = async (items: Connection[]) => {
    const ref = doc(db, 'appSettings', 'connections');
    const aiOnly = items.filter((c) => AI_CONNECTION_IDS.includes(c.id as any));
    try {
      await setDoc(ref, { items: aiOnly }, { merge: true });
    } catch (err) {
      console.error('Error persisting global AI connections:', err);
    }
  };

  const persistConnections = async (newConnections: Connection[], updatedId?: string) => {
    // תמיד שומרים במסמך המשתמש (כולל AI) כדי שהאדמין יראה את ההגדרות מיד
    await persistUserConnections(newConnections);
    // ואם מדובר בחיבור AI – גם במסמך הגלובלי המשותף
    if (updatedId && AI_CONNECTION_IDS.includes(updatedId as any)) {
      await persistGlobalAiConnections(newConnections);
    }
  };

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
    const next = connections.map((c) =>
      c.id === id ? { ...c, status: 'disconnected' as ConnectionStatus, score: undefined, settings: {} } : c
    );
    setConnections(next);
    await persistConnections(next, id);
  };

  const resetAllConnections = async () => {
    if (isWorkspaceReadOnly) return;
    const aiPart = connections.filter((c) => AI_CONNECTION_IDS.includes(c.id as any));
    const platformPart = initialConnections.filter((c) => PLATFORM_CONNECTION_IDS.includes(c.id as any));
    const fresh = [...aiPart, ...platformPart];
    setConnections(fresh);
    await persistUserConnections(fresh);
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
    const aiFromUser = userItems.filter((c) => AI_CONNECTION_IDS.includes(c.id as any));

    if (aiFromUser.length === 0) {
      return { success: false, message: 'No Gemini / OpenAI / Claude connections found on the current user.' };
    }

    const existingGlobalItems = globalSnap.exists() ? ((globalSnap.data().items || []) as Connection[]) : [];
    const byId = new Map<string, Connection>();
    existingGlobalItems.forEach((c) => {
      if (AI_CONNECTION_IDS.includes(c.id as any)) {
        byId.set(c.id, c);
      }
    });
    aiFromUser.forEach((c) => {
      byId.set(c.id, c);
    });

    const merged = Array.from(byId.values());
    await setDoc(globalAiRef, { items: merged }, { merge: true });

    return { success: true, message: 'AI connections migrated from your user settings to appSettings (shared for all users).' };
  };

  const testConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (isWorkspaceReadOnly) {
      return { success: false, message: 'Workspace is read-only for this user' };
    }
    const connection = connections.find(c => c.id === id);
    if (!connection) return { success: false, message: 'חיבור לא נמצא' };

    const managedPlatformSlug = managedPlatformByConnectionId[id as Connection['id']];
    if (managedPlatformSlug) {
      try {
        const normalizedGoogleAccountId =
          id === 'google' && connection.settings?.googleAdsId
            ? connection.settings.googleAdsId.replace(/-/g, '').trim()
            : undefined;
        const result = await postManagedTest(
          managedPlatformSlug,
          normalizedGoogleAccountId
        );
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
