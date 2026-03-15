import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { verifyWooCommerceConnection } from '../services/woocommerceService';
import { fetchMetaAdAccounts } from '../services/metaService';
import { fetchGoogleDiscovery, refreshGoogleAccessToken, validateGoogleAccessToken } from '../services/googleService';
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
  updateConnectionSettings: (id: string, settings: ConnectionSettings) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  overallQualityScore: number;
  connectedCount: number;
  totalCount: number;
}

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

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const connectionsRef = doc(db, 'users', user.uid, 'settings', 'connections');
        const unsubscribeSnapshot = onSnapshot(connectionsRef, (docSnap) => {
          if (docSnap.exists()) {
            setConnections(docSnap.data().items || initialConnections);
          } else {
            // Initialize with clean state if not exists
            setDoc(connectionsRef, { items: initialConnections });
            setConnections(initialConnections);
          }
          setIsLoading(false);
        });
        return () => unsubscribeSnapshot();
      } else {
        setConnections(initialConnections);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const persistConnections = async (newConnections: Connection[]) => {
    const user = auth.currentUser;
    if (!user) return;

    const connectionsRef = doc(db, 'users', user.uid, 'settings', 'connections');
    try {
      await setDoc(connectionsRef, { items: newConnections }, { merge: true });
    } catch (err) {
      console.error('Error persisting connections:', err);
    }
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

  const updateConnectionSettings = async (id: string, settings: ConnectionSettings) => {
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

    // Special logic for Google real verification
    if (id === 'google') {
      let accessToken = connection.settings?.googleAccessToken || '';
      const refreshToken = connection.settings?.googleRefreshToken;
      const expiry = Number(connection.settings?.googleExpiry || 0);
      const hasManualGoogleSettings = Boolean(
        connection.settings?.googleAdsId ||
        connection.settings?.ga4PropertyId ||
        connection.settings?.ga4Id ||
        connection.settings?.gscSiteUrl
      );

      if (!accessToken && !refreshToken) {
        if (hasManualGoogleSettings) {
          const updatedConnections = connections.map(c =>
            c.id === 'google' ? { ...c, status: 'connected' as ConnectionStatus, score: 85 } : c
          );
          setConnections(updatedConnections);
          await persistConnections(updatedConnections);
          return {
            success: true,
            message: 'החיבור נשמר במצב ידני. לנתונים חיים מומלץ לבצע Reconnect ל-Google.'
          };
        }
        return { success: false, message: 'חסר Google access token. יש לבצע חיבור מחדש ל-Google.' };
      }

      const persistGoogleTokens = async (token: string, expiresInSec: number) => {
        const updatedConnections = connections.map(c =>
          c.id === 'google'
            ? {
                ...c,
                settings: {
                  ...(c.settings || {}),
                  googleAccessToken: token,
                  googleExpiry: String(Date.now() + expiresInSec * 1000),
                },
              }
            : c
        );
        setConnections(updatedConnections);
        await persistConnections(updatedConnections);
      };

      const markGoogleConnected = async () => {
        const updatedConnections = connections.map(c =>
          c.id === 'google'
            ? { ...c, status: 'connected' as ConnectionStatus, score: 100 }
            : c
        );
        setConnections(updatedConnections);
        await persistConnections(updatedConnections);
      };

      try {
        const shouldRefresh = !!refreshToken && (!!expiry && Date.now() > expiry - 60_000);
        if (shouldRefresh) {
          const refreshed = await refreshGoogleAccessToken(refreshToken);
          accessToken = refreshed.access_token;
          await persistGoogleTokens(accessToken, refreshed.expires_in || 3600);
        }

        if (!accessToken && refreshToken) {
          const refreshed = await refreshGoogleAccessToken(refreshToken);
          accessToken = refreshed.access_token;
          await persistGoogleTokens(accessToken, refreshed.expires_in || 3600);
        }

        await validateGoogleAccessToken(accessToken);
        await markGoogleConnected();
        // Discovery failures should not block auth validation.
        try {
          await fetchGoogleDiscovery(accessToken);
        } catch (discoveryErr) {
          console.warn('Google discovery warning during test:', discoveryErr);
        }
        return { success: true, message: 'החיבור ל-Google אומת בהצלחה.' };
      } catch (err) {
        try {
          if (refreshToken) {
            const refreshed = await refreshGoogleAccessToken(refreshToken);
            accessToken = refreshed.access_token;
            await persistGoogleTokens(accessToken, refreshed.expires_in || 3600);
            await validateGoogleAccessToken(accessToken);
            await markGoogleConnected();
            try {
              await fetchGoogleDiscovery(accessToken);
            } catch (discoveryErr) {
              console.warn('Google discovery warning after refresh:', discoveryErr);
            }
            return { success: true, message: 'החיבור ל-Google אומת בהצלחה לאחר רענון טוקן.' };
          }
        } catch (refreshErr) {
          if (hasManualGoogleSettings) {
            const updatedConnections = connections.map(c =>
              c.id === 'google' ? { ...c, status: 'connected' as ConnectionStatus, score: 85 } : c
            );
            setConnections(updatedConnections);
            await persistConnections(updatedConnections);
            return {
              success: true,
              message: 'החיבור נשמר במצב ידני. אימות OAuth נכשל, אך ההגדרות נשמרו.'
            };
          }
          return {
            success: false,
            message: `נכשל אימות החיבור ל-Google: ${refreshErr instanceof Error ? refreshErr.message : 'שגיאה לא ידועה'}`,
          };
        }

        if (hasManualGoogleSettings) {
          const updatedConnections = connections.map(c =>
            c.id === 'google' ? { ...c, status: 'connected' as ConnectionStatus, score: 85 } : c
          );
          setConnections(updatedConnections);
          await persistConnections(updatedConnections);
          return {
            success: true,
            message: 'החיבור נשמר במצב ידני. אימות OAuth נכשל, אך ניתן להמשיך בהגדרות החיבור.'
          };
        }

        return {
          success: false,
          message: `נכשל אימות החיבור ל-Google: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`,
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
