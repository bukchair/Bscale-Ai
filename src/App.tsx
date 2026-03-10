/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
import { useLanguage } from './contexts/LanguageContext';

export default function App() {
  console.log('App component is rendering');
  const { dir } = useLanguage();
  const [view, setView] = useState<'landing' | 'auth' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (view === 'landing') {
    return <Landing onEnter={() => setView('auth')} />;
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
        return <Users />;
      case 'settings':
        return <Settings />;
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
