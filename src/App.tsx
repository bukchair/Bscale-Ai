/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Profitability } from './pages/Profitability';
import { Budget } from './pages/Budget';
import { AIRecommendations } from './pages/AIRecommendations';
import { SearchAnalysis } from './pages/SearchAnalysis';
import { SEOReports } from './pages/SEOReports';
import { Audiences } from './pages/Audiences';
import { CreativeLab } from './pages/CreativeLab';
import { Automations } from './pages/Automations';
import { Integrations } from './pages/Integrations';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { WooCommerce } from './pages/WooCommerce';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { useLanguage } from './contexts/LanguageContext';
import { auth, db, onAuthStateChanged, syncUserProfile } from './lib/firebase';
import { AppNavigationProvider } from './contexts/AppNavigationContext';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

const TAB_IDS = [
  'dashboard',
  'profitability',
  'budget',
  'ai-recommendations',
  'search-analysis',
  'seo',
  'products',
  'audiences',
  'creative-lab',
  'approvals-automations',
  'connections',
  'users',
  'settings',
] as const;

const TAB_SET = new Set<string>(TAB_IDS);

export default function App() {
  const { dir } = useLanguage();
  const [view, setView] = useState<'landing' | 'auth' | 'privacy' | 'app'>('landing');
  const getTabFromUrl = () => {
    if (typeof window === 'undefined') return 'dashboard';
    const tabFromUrl = new URLSearchParams(window.location.search).get('tab');
    return tabFromUrl && TAB_SET.has(tabFromUrl) ? tabFromUrl : 'dashboard';
  };

  const updateUrlWithTab = (tab: string, replace = false) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    const nextUrl = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
    if (replace) {
      window.history.replaceState({}, '', nextUrl);
    } else {
      window.history.pushState({}, '', nextUrl);
    }
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const hasExplicitTabInUrl = () => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('tab');
  };

  const navigateToTab = (tab: string, replace = false) => {
    const normalizedTab = TAB_SET.has(tab) ? tab : 'dashboard';
    setActiveTab(normalizedTab);
    setIsSidebarOpen(false);
    updateUrlWithTab(normalizedTab, replace);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await syncUserProfile(user);
        setUserProfile(profile);

        let hasUnreadSystemNotifications = false;
        try {
          const unreadQuery = query(
            collection(db, 'users', user.uid, 'notifications'),
            where('read', '==', false),
            limit(1)
          );
          const unreadSnapshot = await getDocs(unreadQuery);
          hasUnreadSystemNotifications = !unreadSnapshot.empty;
        } catch (error) {
          console.warn('Failed to check unread system notifications:', error);
        }

        const tabFromUrl = getTabFromUrl();
        const hasExplicitTab = hasExplicitTabInUrl();
        if (hasUnreadSystemNotifications) {
          sessionStorage.setItem('bscale-open-notifications', '1');
          navigateToTab(hasExplicitTab ? tabFromUrl : 'approvals-automations', true);
        } else {
          navigateToTab(tabFromUrl, true);
        }
        setView('app');
      } else {
        setUserProfile(null);
        // Only go back to landing if we were in the app
        setView(prev => prev === 'app' ? 'landing' : prev);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (view === 'landing') {
    return <Landing onEnter={() => setView('auth')} onOpenPrivacy={() => setView('privacy')} />;
  }

  if (view === 'privacy') {
    return <PrivacyPolicy onBack={() => setView('landing')} />;
  }

  if (view === 'auth') {
    return <Auth onLogin={() => setView('app')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'profitability':
        return <Profitability />;
      case 'budget':
        return <Budget />;
      case 'ai-recommendations':
        return <AIRecommendations />;
      case 'search-analysis':
        return <SearchAnalysis />;
      case 'seo':
        return <SEOReports />;
      case 'products':
        return <WooCommerce />;
      case 'audiences':
        return <Audiences />;
      case 'creative-lab':
        return <CreativeLab />;
      case 'approvals-automations':
        return <Automations />;
      case 'connections':
        return <Integrations />;
      case 'users':
        return userProfile?.role === 'admin' ? <Users /> : <Dashboard />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppNavigationProvider
      activeTab={activeTab}
      navigateTo={(tab: string) => {
        navigateToTab(tab);
      }}
    >
      <div className="flex h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white transition-colors duration-300" dir={dir}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={navigateToTab} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          userProfile={userProfile}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
          
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-[#050505] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
            {renderContent()}
          </main>
        </div>
      </div>
    </AppNavigationProvider>
  );
}
