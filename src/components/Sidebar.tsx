"use client";

import React, { useState } from 'react';
import { 
  LayoutDashboard,
  Megaphone,
  ShoppingCart,
  LineChart,
  PenTool,
  ShieldAlert,
  Settings,
  Menu,
  X,
  Plug,
  TrendingUp,
  Search,
  Users,
  Activity,
  BarChart3,
  ListTodo,
  User,
  LogOut,
  Mail,
  LifeBuoy,
  ChevronDown,
  ScrollText,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

import { auth, signOut } from '../lib/firebase';

type UserProfile = {
  uid?: string;
  role?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
};

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userProfile?: UserProfile;
}

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
};

export function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen, userProfile }: SidebarProps) {
  const { t, language } = useLanguage();
  const currentUser = auth.currentUser;
  const isAdmin = userProfile?.role === 'admin';
  const canViewLeads = userProfile?.role === 'admin';
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const supportLabel =
    language === 'he'
      ? 'תמיכה טכנית'
      : language === 'ru'
      ? 'Техподдержка'
      : language === 'pt'
      ? 'Suporte tecnico'
      : language === 'fr'
      ? 'Support technique'
      : 'Technical Support';

  const handleLogout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const toggleSubmenu = (itemId: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const navGroups = [
    {
      title: t('nav.performance'),
      items: [
        { id: 'dashboard', label: t('nav.overview'), icon: LayoutDashboard },
        { id: 'profitability', label: t('nav.profitability'), icon: BarChart3 },
        { id: 'budget', label: t('nav.budget'), icon: TrendingUp },
      ] as NavItem[]
    },
    {
      title: t('nav.aiCampaigns'),
      items: [
        {
          id: 'campaigns',
          label: t('nav.campaigns'),
          icon: Megaphone,
          children: [
            { id: 'creative-lab', label: t('nav.creativeLab'), icon: PenTool },
          ],
        },
        { id: 'ai-recommendations', label: t('nav.aiRecommendations'), icon: Activity },
        { id: 'search-analysis', label: t('nav.searchAnalysis'), icon: Search },
      ] as NavItem[]
    },
    {
      title: t('nav.growth'),
      items: [
        { id: 'seo', label: t('nav.seoCenter'), icon: LineChart },
        { id: 'products', label: t('nav.products'), icon: ShoppingCart },
        { id: 'orders', label: t('nav.orders') || 'Orders', icon: ListTodo },
        { id: 'audiences', label: t('nav.audiences'), icon: Users },
      ] as NavItem[]
    },
    {
      title: t('nav.approvalsAutomations') || 'Approvals / Automations',
      items: [
        { id: 'approvals-automations', label: t('nav.approvalsAutomations'), icon: ShieldAlert },
        { id: 'connections', label: t('nav.connections'), icon: Plug },
        { id: 'support', label: supportLabel, icon: LifeBuoy },
        ...(canViewLeads ? [
          { id: 'leads', label: 'לידים', icon: Mail },
        ] : []),
        ...(isAdmin ? [
          { id: 'users', label: t('nav.users'), icon: Users },
          { id: 'system-mail', label: 'דואר מערכת', icon: Mail },
          { id: 'cloud-run-logs', label: 'לוגי Cloud Run', icon: ScrollText },
        ] : []),
        { id: 'settings', label: t('nav.settings'), icon: Settings },
      ] as NavItem[]
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 start-0 z-50 w-64 shrink-0 bg-white dark:bg-[#111] border-e border-gray-200 dark:border-white/10 transition-all duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        "lg:static lg:inset-auto lg:!translate-x-0"
      )}>
        <div className="flex flex-col justify-center h-16 px-6 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{t('app.name')}</span>
              </div>
              <span className="text-[8px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] ps-10 -mt-1 opacity-80">
                AI Powered Engine
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden">
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map((group, idx) => (
            <div key={idx}>
              <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                  const isSubmenuOpen = Boolean(openSubmenus[item.id]);
                  const isChildActive = hasChildren
                    ? item.children!.some((child) => child.id === activeTab)
                    : false;
                  return (
                    <div key={item.id}>
                      <div className={cn(
                        "flex items-center gap-1 rounded-lg",
                        activeTab === item.id || isChildActive
                          ? "bg-indigo-50 dark:bg-indigo-500/10"
                          : ""
                      )}>
                        <button
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "flex items-center flex-1 min-w-0 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                            activeTab === item.id || isChildActive
                              ? "text-indigo-700 dark:text-indigo-400"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                          )}
                        >
                          <Icon className={cn(
                            "w-5 h-5 me-3 shrink-0",
                            activeTab === item.id || isChildActive
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-gray-400 dark:text-gray-500"
                          )} />
                          <span className="truncate">{item.label}</span>
                        </button>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSubmenu(item.id);
                            }}
                            className="me-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                            aria-label={`Toggle ${item.label} submenu`}
                            aria-expanded={isSubmenuOpen}
                          >
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform duration-200",
                                isSubmenuOpen ? "rotate-180" : "rotate-0"
                              )}
                            />
                          </button>
                        )}
                      </div>
                      {hasChildren && (
                        <div
                          className={cn(
                            "mt-1 ps-8 overflow-hidden transition-all duration-200",
                            isSubmenuOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                          )}
                        >
                          <div className="space-y-1 pb-1">
                          {item.children!.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  setActiveTab(child.id);
                                  setIsOpen(false);
                                }}
                                className={cn(
                                  "flex items-center w-full px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors",
                                  activeTab === child.id
                                    ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                                )}
                              >
                                <ChildIcon className={cn(
                                  "w-3.5 h-3.5 me-2",
                                  activeTab === child.id
                                    ? "text-indigo-600 dark:text-indigo-300"
                                    : "text-gray-400 dark:text-gray-500"
                                )} />
                                {child.label}
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="shrink-0 p-4 border-t border-gray-200 dark:border-white/10">
          <div className="group flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold overflow-hidden shadow-sm">
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || ''} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#111] rounded-full shadow-sm" />
            </div>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">
                {currentUser?.displayName || 'User'}
              </p>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mt-0.5">
                {userProfile?.role || 'User'}
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all duration-200"
              title={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
