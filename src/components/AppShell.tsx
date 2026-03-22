"use client";

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SalesBot } from './SalesBot';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { SiteLegalNotice } from './SiteLegalNotice';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfileProvider } from '../contexts/UserProfileContext';
import type { UserProfile } from '../contexts/UserProfileContext';

const PATH_TO_TAB: Record<string, string> = {
  '/':                    'dashboard',
  '/app':                 'dashboard',
  '/dashboard':           'dashboard',
  '/profitability':       'profitability',
  '/budget':              'budget',
  '/campaigns':           'campaigns',
  '/ai-recommendations':  'ai-recommendations',
  '/search-analysis':     'search-analysis',
  '/seo':                 'seo',
  '/products':            'products',
  '/orders':              'orders',
  '/audiences':           'audiences',
  '/creative-lab':        'creative-lab',
  '/automations':         'approvals-automations',
  '/connections':         'connections',
  '/leads':               'leads',
  '/users':               'users',
  '/system-mail':         'system-mail',
  '/settings':            'settings',
  '/support':             'support',
  '/cloud-run-logs':      'cloud-run-logs',
};

const TAB_TO_PATH: Record<string, string> = {
  'dashboard':            '/app',
  'profitability':        '/profitability',
  'budget':               '/budget',
  'campaigns':            '/campaigns',
  'ai-recommendations':   '/ai-recommendations',
  'search-analysis':      '/search-analysis',
  'seo':                  '/seo',
  'products':             '/products',
  'orders':               '/orders',
  'audiences':            '/audiences',
  'creative-lab':         '/creative-lab',
  'approvals-automations':'/automations',
  'connections':          '/connections',
  'leads':                '/leads',
  'users':                '/users',
  'system-mail':          '/system-mail',
  'settings':             '/settings',
  'support':              '/support',
  'cloud-run-logs':       '/cloud-run-logs',
};

type MeResponse = {
  authenticated: boolean;
  user?: UserProfile & { uid?: string };
  workspace?: {
    ownerUid: string;
    accessMode: 'owner' | 'shared';
    sharedRole?: string;
    ownerName?: string;
    ownerEmail?: string;
  };
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dir } = useLanguage();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeTab = PATH_TO_TAB[pathname] ?? 'dashboard';

  const setActiveTab = (tab: string) => {
    router.push((TAB_TO_PATH[tab] ?? '/app') as Parameters<typeof router.push>[0]);
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (cancelled) return;

        if (!res.ok) {
          router.push('/auth');
          return;
        }

        const data = (await res.json()) as MeResponse;
        if (cancelled) return;

        if (!data.authenticated || !data.user) {
          router.push('/auth');
          return;
        }

        setUserProfile(data.user);

        // Handle invitation acceptance from email link
        const urlParams = new URLSearchParams(window.location.search);
        const inviteToken = urlParams.get('accept_invite');
        if (inviteToken) {
          fetch('/api/invitations/accept', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: inviteToken }),
          }).catch((err) => {
            console.error('[AppShell] Failed to accept invitation:', err);
          });
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[AppShell] bootstrap failed:', err);
          router.push('/auth');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <UserProfileProvider value={userProfile}>
      <div
        className="flex h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white transition-colors duration-300"
        dir={dir}
      >
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          userProfile={userProfile}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setIsSidebarOpen(true)} userProfile={userProfile} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-[#050505] p-3 sm:p-6 lg:p-8 transition-colors duration-300">
            {children}
          </main>
          <footer className="shrink-0 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0b0b0b] px-4 sm:px-6 py-3">
            <SiteLegalNotice compact centered />
          </footer>
        </div>
      </div>
      <SalesBot />
      <PwaInstallPrompt />
    </UserProfileProvider>
  );
}
