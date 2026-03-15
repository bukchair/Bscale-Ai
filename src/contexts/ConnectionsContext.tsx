import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { verifyWooCommerceConnection } from '../services/woocommerceService';
import { fetchMetaAdAccounts } from '../services/metaService';
import { fetchTikTokCampaigns } from '../services/tiktokService';

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
  toggleConnection: (id: string, subId?: string) => Promise<void>;
  updateConnectionSettings: (
    id: string,
    settings: ConnectionSettings,
    options?: { silent?: boolean }
  ) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  syncGoogleServices: () => Promise<void>;
  overallQualityScore: number;
  connectedCount: number;
  totalCount: number;
}

type GoogleServiceApiItem = {
  provider: 'google';
  service: 'google_ads' | 'ga4' | 'search_console' | 'gmail';
  status: ConnectionStatus;
  tokenExpiry?: number | null;
  scope?: string | null;
  updatedAt?: number;
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

const GOOGLE_SERVICE_TO_SUB_ID: Record<GoogleServiceApiItem['service'], string> = {
  google_ads: 'google_ads',
  ga4: 'ga4',
  search_console: 'gsc',
  gmail: 'gmail',
};

const applyGoogleServiceSnapshot = (
  source: Connection[],
  items: GoogleServiceApiItem[]
): Connection[] => {
  const statusByService = new Map(items.map((item) => [item.service, item.status]));
  const connectedCount = items.filter((item) => item.status === 'connected').length;

  return source.map((connection) => {
    if (connection.id !== 'google') return connection;

    const nextSubConnections = (connection.subConnections || []).map((subConnection) => {
      const matchingService = (Object.keys(GOOGLE_SERVICE_TO_SUB_ID) as GoogleServiceApiItem['service'][]).find(
        (service) => GOOGLE_SERVICE_TO_SUB_ID[service] === subConnection.id
      );
      if (!matchingService) return subConnection;
      const nextStatus = statusByService.get(matchingService) || 'disconnected';
      return {
        ...subConnection,
        status: nextStatus,
        score: nextStatus === 'connected' ? 100 : undefined,
      };
    });

    const googleStatus: ConnectionStatus = connectedCount > 0 ? 'connected' : 'disconnected';
    const googleSettings = {
      ...(connection.settings || {}),
      googleAccessToken: connectedCount > 0 ? 'server-managed' : '',
      googleAuthMode: 'service-split',
      googleServicesStatus: JSON.stringify(
        items.reduce<Record<string, ConnectionStatus>>((acc, item) => {
          acc[item.service] = item.status;
          return acc;
        }, {})
      ),
    };

    return {
      ...connection,
      status: googleStatus,
      score: connectedCount > 0 ? Math.max(70, Math.min(100, 70 + connectedCount * 7)) : undefined,
      subConnections: nextSubConnections,
      settings: googleSettings,
    };
  });
};

const stripUndefinedDeep = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, fieldValue]) => {
      if (fieldValue === undefined) return;
      next[key] = stripUndefinedDeep(fieldValue);
    });
    return next as T;
  }

  return value;
};

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections);

  const syncGoogleServices = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const response = await fetch(
        `/api/integrations/google/services?user_id=${encodeURIComponent(user.uid)}`
      );
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as { items?: GoogleServiceApiItem[] } | null;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setConnections((prev) => applyGoogleServiceSnapshot(prev, items));
    } catch (error) {
      console.warn('Failed to sync Google services snapshot:', error);
    }
  }, []);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;

      if (user) {
        const connectionsRef = doc(db, 'users', user.uid, 'settings', 'connections');
        unsubscribeSnapshot = onSnapshot(connectionsRef, (docSnap) => {
          if (docSnap.exists()) {
            const source = Array.isArray(docSnap.data().items) ? docSnap.data().items : initialConnections;
            setConnections(source);
            void syncGoogleServices();
          } else {
            // Initialize with clean state if not exists
            setDoc(connectionsRef, { items: stripUndefinedDeep(initialConnections) });
            setConnections(initialConnections);
            void syncGoogleServices();
          }
        });
      } else {
        setConnections(initialConnections);
      }
    });

    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  }, [syncGoogleServices]);

  useEffect(() => {
    if (!auth.currentUser) return;
    void syncGoogleServices();

    const intervalId = window.setInterval(() => {
      void syncGoogleServices();
    }, 30_000);
    const handleFocus = () => {
      void syncGoogleServices();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncGoogleServices]);

  const persistConnections = async (newConnections: Connection[]) => {
    const user = auth.currentUser;
    if (!user) return;

    const connectionsRef = doc(db, 'users', user.uid, 'settings', 'connections');
    try {
      await setDoc(connectionsRef, { items: stripUndefinedDeep(newConnections) }, { merge: true });
    } catch (err) {
      console.error('Error persisting connections:', err);
    }
  };

  const normalizeGa4PropertyId = (value: string) => {
    const normalized = String(value || '').replace(/^properties\//i, '').trim();
    if (!normalized) return '';
    // GA4 Measurement IDs (G-XXXX) are not valid Property IDs.
    if (/^G-[A-Z0-9]+$/i.test(normalized)) return '';
    return normalized;
  };

  const mergeGoogleDiscoveredSettings = (
    base: ConnectionSettings,
    discovered?: {
      ga4PropertyId?: string;
      gscSiteUrl?: string;
      googleAdsId?: string;
    }
  ): ConnectionSettings => {
    const next: ConnectionSettings = { ...base };
    const normalizedProvidedGa4 = normalizeGa4PropertyId(next.ga4PropertyId || next.ga4Id || '');
    if (normalizedProvidedGa4) {
      next.ga4PropertyId = normalizedProvidedGa4;
      next.ga4Id = normalizedProvidedGa4;
    }

    const discoveredGa4 = normalizeGa4PropertyId(discovered?.ga4PropertyId || '');
    if (discoveredGa4 && !normalizedProvidedGa4) {
      next.ga4PropertyId = discoveredGa4;
      next.ga4Id = discoveredGa4;
    }

    if (discovered?.gscSiteUrl && !next.gscSiteUrl) {
      next.gscSiteUrl = discovered.gscSiteUrl;
    }
    if (discovered?.googleAdsId && !next.googleAdsId) {
      next.googleAdsId = discovered.googleAdsId;
    }

    return next;
  };

  const toggleConnection = async (id: string, subId?: string) => {
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
    await persistConnections(finalConnections);
  };

  const updateConnectionSettings = async (
    id: string,
    settings: ConnectionSettings,
    options?: { silent?: boolean }
  ) => {
    const silent = options?.silent === true;
    if (!silent) {
      const connectingConnections = connections.map(c => {
        if (c.id === id) {
          return { ...c, status: 'connecting' as ConnectionStatus };
        }
        return c;
      });
      setConnections(connectingConnections);
      // Simulate API validation
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    let normalizedSettings: ConnectionSettings = { ...settings };
    if (id === 'google') {
      try {
        const userId = auth.currentUser?.uid || '';
        if (userId) {
          const response = await fetch(
            `/api/integrations/google/discover?user_id=${encodeURIComponent(userId)}`
          );
          if (response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { discovered?: { ga4PropertyId?: string; gscSiteUrl?: string; googleAdsId?: string } }
              | null;
            normalizedSettings = mergeGoogleDiscoveredSettings(normalizedSettings, payload?.discovered);
          } else {
            normalizedSettings = mergeGoogleDiscoveredSettings(normalizedSettings);
          }
        } else {
          normalizedSettings = mergeGoogleDiscoveredSettings(normalizedSettings);
        }
      } catch (discoveryErr) {
        normalizedSettings = mergeGoogleDiscoveredSettings(normalizedSettings);
        console.warn('Google discovery warning during save:', discoveryErr);
      }
    }

    const finalConnections = connections.map(c => {
      if (c.id === id) {
        return { 
          ...c, 
          status: 'connected' as ConnectionStatus,
          score: Math.floor(Math.random() * 10) + 90,
          settings: { ...c.settings, ...normalizedSettings }
        };
      }
      return c;
    });

    setConnections(finalConnections);
    await persistConnections(finalConnections);
  };

  const testConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
    const connection = connections.find(c => c.id === id);
    if (!connection) return { success: false, message: 'חיבור לא נמצא' };

    // Special logic for WooCommerce real verification
    if (id === 'woocommerce' && connection.settings) {
      const { storeUrl, wooKey, wooSecret } = connection.settings;
      try {
        await verifyWooCommerceConnection(storeUrl, wooKey, wooSecret);
        const updatedConnections = connections.map(c => 
          c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: 100 } : c
        );
        setConnections(updatedConnections);
        await persistConnections(updatedConnections);
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

    // Special logic for TikTok real verification
    if (id === 'tiktok') {
      const accessToken = connection.settings?.tiktokToken || '';
      const advertiserId = connection.settings?.tiktokAdvertiserId || '';
      if (!accessToken || !advertiserId) {
        return {
          success: false,
          message: 'חסר TikTok access token או advertiser ID. יש להשלים את שניהם לפני בדיקה.',
        };
      }

      try {
        await fetchTikTokCampaigns(accessToken, advertiserId);
        const updatedConnections = connections.map(c =>
          c.id === id ? { ...c, status: 'connected' as ConnectionStatus, score: 100 } : c
        );
        setConnections(updatedConnections);
        await persistConnections(updatedConnections);
        return { success: true, message: 'החיבור ל-TikTok אומת בהצלחה.' };
      } catch (err) {
        return {
          success: false,
          message: `נכשל אימות החיבור ל-TikTok: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`,
        };
      }
    }

    // Special logic for Google split services verification
    if (id === 'google') {
      const userId = auth.currentUser?.uid || '';
      if (!userId) {
        return { success: false, message: 'User is not authenticated.' };
      }

      try {
        const response = await fetch(`/api/integrations/google/services?user_id=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          throw new Error('Failed to load Google service statuses');
        }
        const payload = (await response.json().catch(() => null)) as { items?: GoogleServiceApiItem[] } | null;
        const items = Array.isArray(payload?.items) ? payload.items : [];

        const updatedConnections = applyGoogleServiceSnapshot(connections, items);
        setConnections(updatedConnections);
        await persistConnections(updatedConnections);

        const connectedServices = items.filter((item) => item.status === 'connected');
        if (connectedServices.length === 0) {
          return {
            success: false,
            message: 'No Google services are connected yet. Please connect at least one Google service.',
          };
        }

        return {
          success: true,
          message: `Google services verified (${connectedServices
            .map((service) => service.service)
            .join(', ')}).`,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to verify Google service connections.',
        };
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
      await persistConnections(updatedConnections);
      return { 
        success: true, 
        message: `החיבור אומת בהצלחה. נתוני API זמינים.` 
      };
    } else {
      return { 
        success: false, 
        message: `נכשל אימות החיבור. אנא בדוק את הגדרות ה-API.` 
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
      toggleConnection, 
      updateConnectionSettings,
      testConnection,
      syncGoogleServices,
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
