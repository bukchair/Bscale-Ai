import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Bell, Search, User, ChevronDown, CheckCircle, AlertTriangle, Calendar, BrainCircuit } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange, DateRangeType } from '../contexts/DateRangeContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { cn } from '../lib/utils';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface HeaderProps {
  onMenuClick: () => void;
  userProfile?: any;
}

type PendingUserApproval = {
  uid: string;
  name: string;
  email: string;
  createdAt?: string;
  role?: string;
  subscriptionStatus?: string;
  approvalReadBy?: Record<string, string>;
};

type NotificationItem = {
  id: string | number;
  type: string;
  title: string;
  desc: string;
  time: string;
  icon: React.ElementType;
  color: string;
  unread: boolean;
  actionLabel?: string;
  actionClassName?: string;
  onAction?: () => void;
};

export function Header({ onMenuClick, userProfile }: HeaderProps) {
  const { t, dir } = useLanguage();
  const { dateRange, setDateRange, customRange, setCustomRange } = useDateRange();
  const { connections, overallQualityScore, connectedCount, totalCount } = useConnections();
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [liveLeadToast, setLiveLeadToast] = useState<{ id: string; name: string; contact: string } | null>(null);
  const [livePendingUserToast, setLivePendingUserToast] = useState<{ uid: string; name: string; email: string } | null>(null);
  const [leadNotifications, setLeadNotifications] = useState<Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    createdAt: string;
    sourcePath?: string;
    readBy?: Record<string, string>;
  }>>([]);
  const [pendingUserApprovals, setPendingUserApprovals] = useState<PendingUserApproval[]>([]);
  const isDemo = userProfile?.subscriptionStatus === 'demo';
  const canViewLeads = userProfile?.role === 'admin';
  const canApproveUsers = userProfile?.role === 'admin';
  const currentUid = auth.currentUser?.uid;
  const previousNewestLeadRef = useRef<string | null>(null);
  const previousNewestPendingUserRef = useRef<string | null>(null);
  const hasInitializedLeadFeed = useRef(false);
  const hasInitializedPendingFeed = useRef(false);

  const tr = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const fallbackNotifications = [
    { id: 1, type: 'ai', title: t('notifications.items.ai_ready'), desc: t('notifications.items.ai_ready_desc'), time: '2h ago', icon: CheckCircle, color: 'text-emerald-500' },
    { id: 2, type: 'budget', title: t('notifications.items.budget_alert'), desc: t('notifications.items.budget_alert_desc'), time: '5h ago', icon: AlertTriangle, color: 'text-amber-500' },
    { id: 3, type: 'feature', title: t('notifications.items.new_feature'), desc: t('notifications.items.new_feature_desc'), time: '1d ago', icon: Search, color: 'text-indigo-500' },
    { id: 4, type: 'error', title: t('notifications.items.connection_error'), desc: t('notifications.items.connection_error_desc'), time: '2d ago', icon: AlertTriangle, color: 'text-red-500' },
  ];

  useEffect(() => {
    if (!canViewLeads) {
      setLeadNotifications([]);
      return;
    }

    const leadsQuery = query(collection(db, 'salesLeads'), orderBy('createdAt', 'desc'), limit(25));
    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        const leads = snapshot.docs.map((leadDoc) => ({ id: leadDoc.id, ...(leadDoc.data() as any) }));
        if (!hasInitializedLeadFeed.current) {
          hasInitializedLeadFeed.current = true;
          previousNewestLeadRef.current = leads[0]?.id || null;
        }
        setLeadNotifications(leads);
      },
      (error) => {
        console.error('Failed to subscribe to sales lead notifications:', error);
      }
    );

    return () => unsubscribe();
  }, [canViewLeads]);

  useEffect(() => {
    if (!canApproveUsers) {
      setPendingUserApprovals([]);
      return;
    }

    const pendingUsersQuery = query(
      collection(db, 'users'),
      where('subscriptionStatus', '==', 'demo'),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      pendingUsersQuery,
      (snapshot) => {
        const pendingUsers = snapshot.docs
          .map((userDoc) => ({ uid: userDoc.id, ...(userDoc.data() as any) }) as PendingUserApproval)
          .filter((user) => user.role !== 'admin')
          .sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
          });
        if (!hasInitializedPendingFeed.current) {
          hasInitializedPendingFeed.current = true;
          previousNewestPendingUserRef.current = pendingUsers[0]?.uid || null;
        }
        setPendingUserApprovals(pendingUsers);
      },
      (error) => {
        console.error('Failed to subscribe to pending user approvals:', error);
      }
    );

    return () => unsubscribe();
  }, [canApproveUsers]);

  const playLeadAlertSound = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
      window.setTimeout(() => ctx.close(), 500);
    } catch (error) {
      console.warn('Failed to play lead alert sound:', error);
    }
  };

  useEffect(() => {
    if (!canViewLeads || !hasInitializedLeadFeed.current || leadNotifications.length === 0) return;
    const newestLead = leadNotifications[0];

    if (previousNewestLeadRef.current !== newestLead.id) {
      const contact = newestLead.email || newestLead.phone || tr('notifications.noContact', 'ללא פרטי קשר');
      setLiveLeadToast({ id: newestLead.id, name: newestLead.name, contact });
      playLeadAlertSound();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(tr('notifications.newLeadTitle', 'ליד חדש מהאתר'), {
          body: `${newestLead.name} • ${contact}`,
        });
      }
      previousNewestLeadRef.current = newestLead.id;
    }
  }, [canViewLeads, leadNotifications]);

  useEffect(() => {
    if (!canApproveUsers || !hasInitializedPendingFeed.current || pendingUserApprovals.length === 0) return;
    const newestPendingUser = pendingUserApprovals[0];
    if (previousNewestPendingUserRef.current !== newestPendingUser.uid) {
      setLivePendingUserToast({
        uid: newestPendingUser.uid,
        name: newestPendingUser.name || 'User',
        email: newestPendingUser.email || '—',
      });
      playLeadAlertSound();
      previousNewestPendingUserRef.current = newestPendingUser.uid;
    }
  }, [canApproveUsers, pendingUserApprovals]);

  useEffect(() => {
    if (!liveLeadToast) return;
    const timeout = window.setTimeout(() => setLiveLeadToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [liveLeadToast]);

  useEffect(() => {
    if (!livePendingUserToast) return;
    const timeout = window.setTimeout(() => setLivePendingUserToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [livePendingUserToast]);

  const handleApproveUserAsFree = async (userId: string) => {
    if (!currentUid) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscriptionStatus: 'free',
        plan: 'free_by_admin',
        approvedByAdminUid: currentUid,
        approvedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to approve user from demo to free:', error);
    }
  };

  const unreadLeadCount = useMemo(() => {
    if (!currentUid) return 0;
    return leadNotifications.filter((lead) => !lead.readBy?.[currentUid]).length;
  }, [currentUid, leadNotifications]);

  const unreadPendingUserCount = useMemo(() => {
    if (!currentUid) return 0;
    return pendingUserApprovals.filter((user) => !user.approvalReadBy?.[currentUid]).length;
  }, [currentUid, pendingUserApprovals]);

  const leadNotificationItems = useMemo(
    () =>
      leadNotifications.map((lead) => ({
        id: `lead-${lead.id}`,
        type: 'lead',
        title: tr('notifications.newLeadTitle', 'ליד חדש מהאתר'),
        desc: `${lead.name} • ${lead.email || lead.phone || tr('notifications.noContact', 'ללא פרטי קשר')}`,
        time: lead.createdAt ? new Date(lead.createdAt).toLocaleString(dir === 'rtl' ? 'he-IL' : 'en-US') : '--',
        icon: User,
        color: 'text-indigo-500',
        unread: currentUid ? !lead.readBy?.[currentUid] : false,
      })),
    [currentUid, dir, leadNotifications]
  );
  const pendingUserNotificationItems = useMemo(
    () =>
      pendingUserApprovals.map((pendingUser) => ({
        id: `pending-user-${pendingUser.uid}`,
        type: 'pending-user',
        title: tr('notifications.newUserApprovalTitle', 'משתמש חדש ממתין לאישור'),
        desc: `${pendingUser.name || 'User'} • ${pendingUser.email || '—'}`,
        time: pendingUser.createdAt
          ? new Date(pendingUser.createdAt).toLocaleString(dir === 'rtl' ? 'he-IL' : 'en-US')
          : '--',
        icon: User,
        color: 'text-amber-600',
        unread: currentUid ? !pendingUser.approvalReadBy?.[currentUid] : false,
        actionLabel: tr('notifications.approveFreeAction', 'אשר כחשבון ללא תשלום'),
        actionClassName:
          'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100',
        onAction: () => handleApproveUserAsFree(pendingUser.uid),
      })),
    [currentUid, dir, pendingUserApprovals]
  );

  const notifications: NotificationItem[] = canViewLeads
    ? [...pendingUserNotificationItems, ...leadNotificationItems]
    : fallbackNotifications.map((item) => ({ ...item, unread: false }));
  const unreadNotificationsCount = unreadLeadCount + unreadPendingUserCount;

  const handleToggleNotifications = async () => {
    const nextState = !isNotificationsOpen;
    setIsNotificationsOpen(nextState);
    if (nextState && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
    if (!nextState || !currentUid || !canViewLeads) return;

    const unreadLeads = leadNotifications.filter((lead) => !lead.readBy?.[currentUid]);
    if (unreadLeads.length === 0) return;

    await Promise.all(
      unreadLeads.map((lead) =>
        updateDoc(doc(db, 'salesLeads', lead.id), {
          [`readBy.${currentUid}`]: new Date().toISOString(),
        }).catch((error) => {
          console.warn('Failed to mark lead notification as read:', error);
        })
      )
    );

    const unreadPendingUsers = pendingUserApprovals.filter((pendingUser) => !pendingUser.approvalReadBy?.[currentUid]);
    await Promise.all(
      unreadPendingUsers.map((pendingUser) =>
        updateDoc(doc(db, 'users', pendingUser.uid), {
          [`approvalReadBy.${currentUid}`]: new Date().toISOString(),
        }).catch((error) => {
          console.warn('Failed to mark pending user notification as read:', error);
        })
      )
    );
  };

  const handleDateClick = (range: DateRangeType) => {
    setDateRange(range);
    if (range === 'custom') {
      setIsDatePickerOpen(true);
    } else {
      setIsDatePickerOpen(false);
    }
  };

  return (
    <header className="bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/10 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="flex items-center flex-1 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="p-2 me-1 text-gray-500 dark:text-gray-400 rounded-md lg:hidden hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <Menu className="w-6 h-6" />
          </button>
          {/* לוגו קומפקטי במיוחד למובייל, שומר על אייקון יפה */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-500 shadow-md flex items-center justify-center text-white">
              <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="hidden xs:inline-block text-sm sm:text-base font-black tracking-tight text-gray-900 dark:text-white">
              BScale AI
            </span>
          </div>
        </div>

        {isDemo && (
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('pricing');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                window.location.href = '/#pricing';
              }
            }}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold max-w-xs"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="truncate">{t('subscription.demoBadge') || 'חשבון דמו — להצטרפות לשירות עבור למסך המנויים.'}</span>
          </button>
        )}

        <div className="hidden sm:flex items-center gap-2 relative ms-2">
          <div className="flex items-center bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-1">
            <button 
              onClick={() => handleDateClick('today')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", dateRange === 'today' ? "bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white")}
            >
              {t('dashboard.today')}
            </button>
            <button 
              onClick={() => handleDateClick('7days')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", dateRange === '7days' ? "bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white")}
            >
              {t('dashboard.last7Days')}
            </button>
            <button 
              onClick={() => handleDateClick('30days')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", dateRange === '30days' ? "bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white")}
            >
              {t('dashboard.last30Days')}
            </button>
            <button 
              onClick={() => handleDateClick('custom')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1", dateRange === 'custom' ? "bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white")}
            >
              <Calendar className="w-3 h-3" />
              {t('dashboard.customRange')}
            </button>
          </div>

          {isDatePickerOpen && dateRange === 'custom' && (
            <div className="absolute top-full mt-2 left-0 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 p-4 flex gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('header.startDate')}</label>
                <input 
                  type="date" 
                  className="text-sm border-gray-300 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={customRange.start ? customRange.start.toISOString().split('T')[0] : ''}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value ? new Date(e.target.value) : null })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('header.endDate')}</label>
                <input 
                  type="date" 
                  className="text-sm border-gray-300 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={customRange.end ? customRange.end.toISOString().split('T')[0] : ''}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value ? new Date(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          <div className="relative ms-4">
            <button 
              onClick={() => setIsConnectionsOpen(!isConnectionsOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <span className={cn(
                "flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                overallQualityScore >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                overallQualityScore >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
              )} dir="ltr">
                {overallQualityScore}% {t('header.sync')}
              </span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{connectedCount}/{totalCount} {t('header.active')}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {isConnectionsOpen && (
              <div className={cn("absolute top-full mt-2 w-80 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 p-4", dir === 'rtl' ? "right-0" : "left-0")}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('dashboard.connectionQuality')}</h4>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{connectedCount} {t('nav.connections')}</span>
                </div>
                
                <div className="space-y-3 mb-4">
                  {connections.map((conn) => (
                    <div key={conn.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full", conn.status === 'connected' ? 'bg-emerald-500' : conn.status === 'error' ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600')} />
                          <span className="text-gray-700 dark:text-gray-300 font-bold truncate max-w-[140px]" title={conn.name}>{conn.name}</span>
                        </div>
                        {conn.status === 'error' ? (
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        ) : conn.status === 'connected' ? (
                          <div className="flex items-center gap-2 shrink-0">
                            {conn.score && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded" dir="ltr">{conn.score}% {t('header.sync')}</span>}
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 font-bold">{t('header.disconnected')}</span>
                        )}
                      </div>
                      {conn.status === 'connected' && conn.score && (
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-1">
                          <div className={cn("h-1.5 rounded-full", conn.score >= 80 ? 'bg-emerald-500' : conn.score >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${conn.score}%` }}></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                  {t('dashboard.manageConnections')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <LanguageSwitcher />
        
        <div className="relative">
          <button 
            onClick={handleToggleNotifications}
            className={cn(
              "p-2 rounded-lg transition-colors relative",
              isNotificationsOpen ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            )}
          >
            <Bell className="w-6 h-6" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 end-1.5 block w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#111]" />
            )}
          </button>

          {isNotificationsOpen && (
            <div className={cn(
              "absolute top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 overflow-hidden",
              dir === 'rtl' ? "left-0" : "right-0"
            )}>
              <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('notifications.title')}</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {canViewLeads
                      ? tr('notifications.leadSubtitle', 'כל ליד חדש וכל משתמש דמו חדש יופיעו כאן בזמן אמת.')
                      : t('notifications.subtitle')}
                  </p>
                </div>
                {canViewLeads ? (
                  <div className="flex items-center gap-2">
                    <button
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      onClick={() => {
                        window.history.pushState({}, '', '/users');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        setIsNotificationsOpen(false);
                      }}
                    >
                      {tr('notifications.manageUsers', 'ניהול משתמשים')}
                    </button>
                    <button
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      onClick={() => {
                        window.history.pushState({}, '', '/leads');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        setIsNotificationsOpen(false);
                      }}
                    >
                      {tr('notifications.viewLeads', 'ניהול לידים')}
                    </button>
                  </div>
                ) : (
                  <button className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                    {t('notifications.clearAll')}
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="w-full p-4 flex gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-start"
                      >
                        <div className={cn("p-2 rounded-lg bg-gray-100 dark:bg-white/5 shrink-0", notif.color)}>
                          <notif.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{notif.title}</p>
                            <div className="flex items-center gap-2">
                              {(notif as any).unread && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{notif.time}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
                            {notif.desc}
                          </p>
                          {notif.onAction && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                notif.onAction?.();
                              }}
                              className={cn(
                                'mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors',
                                notif.actionClassName ||
                                  'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'
                              )}
                            >
                              {notif.actionLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('notifications.empty')}</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 text-center">
                <button className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                  {t('common.viewAll')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {liveLeadToast && (
        <div className={cn("fixed top-20 z-[90] w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[320px]", dir === 'rtl' ? 'left-4 sm:left-6' : 'right-4 sm:right-6')}>
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-indigo-500">
            <p className="text-xs font-black uppercase tracking-wider mb-1">{tr('notifications.newLeadTitle', 'ליד חדש מהאתר')}</p>
            <p className="text-sm font-bold">{liveLeadToast.name}</p>
            <p className="text-xs text-indigo-100">{liveLeadToast.contact}</p>
          </div>
        </div>
      )}
      {livePendingUserToast && (
        <div className={cn("fixed top-36 z-[90] w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[320px]", dir === 'rtl' ? 'left-4 sm:left-6' : 'right-4 sm:right-6')}>
          <div className="bg-amber-500 text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-400">
            <p className="text-xs font-black uppercase tracking-wider mb-1">
              {tr('notifications.newUserApprovalTitle', 'משתמש חדש ממתין לאישור')}
            </p>
            <p className="text-sm font-bold">{livePendingUserToast.name}</p>
            <p className="text-xs text-amber-100" dir="ltr">
              {livePendingUserToast.email}
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
