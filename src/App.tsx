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
import { Campaigns } from './pages/Campaigns';
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
import { SubscriptionRequired } from './pages/SubscriptionRequired';
import { WooCommerce } from './pages/WooCommerce';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { useLanguage } from './contexts/LanguageContext';
import { auth, onAuthStateChanged, syncUserProfile } from './lib/firebase';
import { runAutoAdsIfNeeded } from './lib/autoAdsRunner';

export default function App() {
  const { dir } = useLanguage();
  const [view, setView] = useState<'landing' | 'auth' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [scrollToPricing, setScrollToPricing] = useState(false);

  const path = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Public privacy policy page – זמין בלי התחברות
  if (path === '/privacy-policy') {
    return <PrivacyPolicy />;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await syncUserProfile(user);
        setUserProfile(profile);
        setView('app');
        runAutoAdsIfNeeded(user.uid).catch(() => {});
      } else {
        setUserProfile(null);
        // Only go back to landing if we were in the app
        setView(prev => prev === 'app' ? 'landing' : prev);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (view === 'landing') {
    return <Landing onEnter={() => { setView('auth'); setScrollToPricing(false); }} scrollToPricing={scrollToPricing} />;
  }

  if (view === 'auth') {
    return <Auth onLogin={() => setView('app')} />;
  }

  const hasAccess =
    userProfile?.role === 'admin' ||
    userProfile?.subscriptionStatus === 'active' ||
    userProfile?.subscriptionStatus === undefined;
  if (view === 'app' && !hasAccess) {
    return (
      <SubscriptionRequired
        onGoToPricing={() => {
          setView('landing');
          setScrollToPricing(true);
        }}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'profitability':
        return <Profitability />;
      case 'budget':
        return <Budget />;
      case 'campaigns':
        return <Campaigns />;
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
        return <Integrations userProfile={userProfile} />;
      case 'users':
        return userProfile?.role === 'admin' ? <Users /> : <Dashboard />;
      case 'settings':
        return <Settings userProfile={userProfile} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white transition-colors duration-300" dir={dir}>
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
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
  );
}
