import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  overallQualityScore: number;
  connectedCount: number;
  totalCount: number;
}

const initialConnections: Connection[] = [
  { 
    id: 'gemini', 
    name: 'Google Gemini AI', 
    category: 'AI Engine', 
    status: 'connected', 
    score: 100,
    description: 'The core AI engine powering recommendations, creative generation, and automated optimizations.' 
  },
  { 
    id: 'google', 
    name: 'Google Ecosystem', 
    category: 'Google', 
    status: 'connected', 
    score: 85,
    description: 'Connect all Google services at once. Includes Ads, Analytics 4, Search Console, and Gmail for reports.',
    subConnections: [
      { id: 'google_ads', name: 'Google Ads', status: 'connected', score: 90 },
      { id: 'ga4', name: 'Google Analytics 4', status: 'connected', score: 85 },
      { id: 'gsc', name: 'Search Console', status: 'connected', score: 80 },
      { id: 'gmail', name: 'Gmail / Reports', status: 'connected', score: 85 },
    ]
  },
  { 
    id: 'meta', 
    name: 'Meta (Ads, Pixel)', 
    category: 'Social', 
    status: 'connected', 
    score: 92,
    description: 'Manage Facebook and Instagram campaigns, sync audiences, and track pixel conversions.' 
  },
  { 
    id: 'tiktok', 
    name: 'TikTok Ads', 
    category: 'Social', 
    status: 'error',
    description: 'Manage video campaigns on TikTok, track conversions and trends.' 
  },
  { 
    id: 'woocommerce', 
    name: 'WooCommerce', 
    category: 'E-commerce', 
    status: 'connected', 
    score: 100,
    description: 'Sync products, inventory, orders, and automatically update product descriptions and SEO.' 
  },
  { 
    id: 'shopify', 
    name: 'Shopify', 
    category: 'E-commerce', 
    status: 'disconnected',
    description: 'Connect your Shopify store to sync products, track sales, and optimize campaigns.' 
  },
];

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>(() => {
    const saved = localStorage.getItem('connections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved connections', e);
      }
    }
    return initialConnections;
  });

  useEffect(() => {
    localStorage.setItem('connections', JSON.stringify(connections));
  }, [connections]);

  const toggleConnection = async (id: string, subId?: string) => {
    setConnections(prev => prev.map(c => {
      if (c.id === id) {
        if (subId && c.subConnections) {
          return {
            ...c,
            subConnections: c.subConnections.map(sc => 
              sc.id === subId ? { ...sc, status: 'connecting' } : sc
            )
          };
        }
        return { ...c, status: 'connecting' };
      }
      return c;
    }));
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setConnections(prev => prev.map(c => {
      if (c.id === id) {
        if (subId && c.subConnections) {
          const newSubConnections = c.subConnections.map(sc => {
            if (sc.id === subId) {
              const isSuccess = Math.random() > 0.2;
              return {
                ...sc,
                status: sc.status === 'connecting' ? (isSuccess ? 'connected' : 'error') : 'disconnected',
                score: isSuccess ? Math.floor(Math.random() * 20) + 80 : undefined
              };
            }
            return sc;
          });
          
          // Update parent status based on sub-connections
          const allConnected = newSubConnections.every(sc => sc.status === 'connected');
          const anyConnected = newSubConnections.some(sc => sc.status === 'connected');
          
          return {
            ...c,
            subConnections: newSubConnections,
            status: allConnected ? 'connected' : (anyConnected ? 'connected' : 'disconnected'),
            score: anyConnected ? Math.round(newSubConnections.filter(sc => sc.status === 'connected').reduce((acc, curr) => acc + (curr.score || 0), 0) / newSubConnections.filter(sc => sc.status === 'connected').length) : undefined
          };
        }

        if (c.status === 'connecting') {
          const isSuccess = Math.random() > 0.3;
          return { 
            ...c, 
            status: isSuccess ? 'connected' : 'error',
            score: isSuccess ? Math.floor(Math.random() * 20) + 80 : undefined
          };
        } else {
          return { ...c, status: 'disconnected', score: undefined };
        }
      }
      return c;
    }));
  };

  const updateConnectionSettings = async (id: string, settings: ConnectionSettings) => {
    setConnections(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: 'connecting' };
      }
      return c;
    }));
    
    // Simulate API validation
    await new Promise(resolve => setTimeout(resolve, 1000));

    setConnections(prev => prev.map(c => {
      if (c.id === id) {
        return { 
          ...c, 
          status: 'connected',
          score: Math.floor(Math.random() * 10) + 90, // High score for valid settings
          settings: { ...c.settings, ...settings }
        };
      }
      return c;
    }));
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
