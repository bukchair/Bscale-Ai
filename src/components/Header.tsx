import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Bell, ChevronDown, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange, DateRangeType } from '../contexts/DateRangeContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { cn } from '../lib/utils';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { auth, db, onAuthStateChanged } from '../lib/firebase';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';

interface HeaderProps {
  onMenuClick: () => void;
}

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  read?: boolean;
  createdAt?: string;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { t, dir } = useLanguage();
  const isHebrew = dir === 'rtl';
  const { navigateTo } = useAppNavigation();
  const { dateRange, setDateRange, customRange, setCustomRange } = useDateRange();
  const { connections, overallQualityScore, connectedCount, totalCount } = useConnections();
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isMobileDateMenuOpen, setIsMobileDateMenuOpen] = useState(false);
  const [isMobileConnectionsOpen, setIsMobileConnectionsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [activeUid, setActiveUid] = useState<string | null>(auth.currentUser?.uid || null);
  const [showNotificationsHint, setShowNotificationsHint] = useState(false);
  const prevUnreadRef = useRef(0);
  const toInputDate = (value: Date | null) => {
    if (!value) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setActiveUid(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeUid) {
      setSystemNotifications([]);
      prevUnreadRef.current = 0;
      return;
    }

    const notificationsQuery = query(
      collection(db, 'users', activeUid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => {
        const data = item.data() as Omit<SystemNotification, 'id'>;
        return {
          id: item.id,
          ...data,
        };
      });
      setSystemNotifications(next);
    });

    return () => unsubscribe();
  }, [activeUid]);

  useEffect(() => {
    const shouldOpen = sessionStorage.getItem('bscale-open-notifications') === '1';
    if (shouldOpen) {
      sessionStorage.removeItem('bscale-open-notifications');
      setIsNotificationsOpen(true);
      setShowNotificationsHint(true);
    }
  }, []);

  const unreadCount = useMemo(
    () => systemNotifications.filter((item) => !item.read).length,
    [systemNotifications]
  );

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setShowNotificationsHint(true);
      setIsNotificationsOpen(true);
    }
    if (unreadCount === 0) {
      setShowNotificationsHint(false);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const formatNotificationTime = (createdAt?: string) => {
    if (!createdAt) return isHebrew ? 'עכשיו' : 'Now';
    const ts = new Date(createdAt).getTime();
    if (!Number.isFinite(ts)) return isHebrew ? 'עכשיו' : 'Now';
    const diffMs = Math.max(0, Date.now() - ts);
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 1) return isHebrew ? 'עכשיו' : 'Now';
    if (diffMinutes < 60) return isHebrew ? `לפני ${diffMinutes} דק׳` : `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return isHebrew ? `לפני ${diffHours} שעות` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return isHebrew ? `לפני ${diffDays} ימים` : `${diffDays}d ago`;
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!activeUid) return;
    try {
      await updateDoc(doc(db, 'users', activeUid, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!activeUid) return;
    const unread = systemNotifications.filter((item) => !item.read);
    await Promise.all(unread.map((item) => markNotificationRead(item.id)));
  };

  const handleNotificationClick = async (notificationId: string) => {
    await markNotificationRead(notificationId);
    navigateTo('approvals-automations');
    setIsNotificationsOpen(false);
    setShowNotificationsHint(false);
  };

  const handleDateClick = (range: DateRangeType) => {
    setDateRange(range);
    setIsMobileDateMenuOpen(false);
    if (range === 'custom') {
      setIsDatePickerOpen(true);
    } else {
      setIsDatePickerOpen(false);
    }
  };

  const mobileDateLabel =
    dateRange === 'today' ? t('dashboard.today') :
    dateRange === '7days' ? t('dashboard.last7Days') :
    dateRange === '30days' ? t('dashboard.last30Days') :
    t('dashboard.customRange');

  return (
    <header className="relative bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/10 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="flex items-center flex-1">
        <button
          onClick={onMenuClick}
          className="p-2 me-2 text-gray-500 dark:text-gray-400 rounded-md lg:hidden hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="sm:hidden flex items-center gap-2">
          <button
            onClick={() => {
              setIsMobileDateMenuOpen((prev) => !prev);
              setIsMobileConnectionsOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] text-[11px] font-bold text-gray-700 dark:text-gray-300"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="max-w-[90px] truncate">{mobileDateLabel}</span>
          </button>
          <button
            onClick={() => {
              setIsMobileConnectionsOpen((prev) => !prev);
              setIsMobileDateMenuOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] text-[11px] font-bold text-gray-700 dark:text-gray-300"
          >
            <span dir="ltr">{connectedCount}/{totalCount}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 relative">
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
                  value={toInputDate(customRange.start)}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{t('header.endDate')}</label>
                <input 
                  type="date" 
                  className="text-sm border-gray-300 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={toInputDate(customRange.end)}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })}
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
                          <span className="text-gray-700 dark:text-gray-300 font-bold truncate max-w-[140px]" title={t(conn.name)}>{t(conn.name)}</span>
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

                <button
                  onClick={() => {
                    navigateTo('connections');
                    setIsConnectionsOpen(false);
                  }}
                  className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  {t('dashboard.manageConnections')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeSwitcher />
        <LanguageSwitcher />
        
        <div className="relative">
          <button 
            onClick={() => {
              setIsNotificationsOpen((prev) => !prev);
              setShowNotificationsHint(false);
            }}
            className={cn(
              "p-2 rounded-lg transition-colors relative",
              isNotificationsOpen ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            )}
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <>
                <span className="absolute top-1.5 end-1.5 block w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#111]" />
                <span className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </>
            )}
          </button>

          {showNotificationsHint && unreadCount > 0 && (
            <div className={cn(
              "absolute top-full mt-2 z-50 px-3 py-2 rounded-lg bg-indigo-600 text-white text-[11px] font-bold shadow-lg",
              dir === 'rtl' ? "left-0" : "right-0"
            )}>
              {isHebrew ? 'יש לך הודעת מערכת חדשה בהתראות' : 'You have a new system alert'}
            </div>
          )}

          {isNotificationsOpen && (
            <div className={cn(
              "absolute top-full mt-2 w-[calc(100vw-1rem)] max-w-96 sm:w-96 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 overflow-hidden",
              dir === 'rtl' ? "left-0" : "right-0"
            )}>
              <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{t('notifications.title')}</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {isHebrew
                      ? `הודעות מערכת פעילות: ${systemNotifications.length}`
                      : `Active system alerts: ${systemNotifications.length}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    void markAllNotificationsRead();
                  }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {t('notifications.clearAll')}
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {systemNotifications.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {systemNotifications.map((notif) => (
                      <button 
                        key={notif.id}
                        onClick={() => {
                          void handleNotificationClick(notif.id);
                        }}
                        className="w-full p-4 flex gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-start"
                      >
                        <div
                          className={cn(
                            "p-2 rounded-lg bg-gray-100 dark:bg-white/5 shrink-0",
                            notif.read ? "text-gray-400" : "text-indigo-600"
                          )}
                        >
                          {notif.type === 'system' ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn("text-xs font-bold truncate", notif.read ? "text-gray-600 dark:text-gray-300" : "text-gray-900 dark:text-white")}>
                              {notif.title || (isHebrew ? 'הודעת מערכת' : 'System message')}
                            </p>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                              {formatNotificationTime(notif.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                      </button>
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
                <button
                  onClick={() => {
                    navigateTo('approvals-automations');
                    setIsNotificationsOpen(false);
                  }}
                  className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {t('common.viewAll')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isMobileDateMenuOpen && (
        <div className="sm:hidden absolute top-full mt-2 left-2 right-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDateClick('today')}
              className={cn("px-3 py-2 text-xs font-bold rounded-lg", dateRange === 'today' ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300")}
            >
              {t('dashboard.today')}
            </button>
            <button
              onClick={() => handleDateClick('7days')}
              className={cn("px-3 py-2 text-xs font-bold rounded-lg", dateRange === '7days' ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300")}
            >
              {t('dashboard.last7Days')}
            </button>
            <button
              onClick={() => handleDateClick('30days')}
              className={cn("px-3 py-2 text-xs font-bold rounded-lg", dateRange === '30days' ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300")}
            >
              {t('dashboard.last30Days')}
            </button>
            <button
              onClick={() => handleDateClick('custom')}
              className={cn("px-3 py-2 text-xs font-bold rounded-lg", dateRange === 'custom' ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300")}
            >
              {t('dashboard.customRange')}
            </button>
          </div>
          {dateRange === 'custom' && (
            <div className="grid grid-cols-1 gap-2">
              <input
                type="date"
                className="text-sm border-gray-300 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white rounded-md shadow-sm"
                value={toInputDate(customRange.start)}
                onChange={(e) => setCustomRange({ ...customRange, start: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })}
              />
              <input
                type="date"
                className="text-sm border-gray-300 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white rounded-md shadow-sm"
                value={toInputDate(customRange.end)}
                onChange={(e) => setCustomRange({ ...customRange, end: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })}
              />
            </div>
          )}
        </div>
      )}

      {isMobileConnectionsOpen && (
        <div className="sm:hidden absolute top-full mt-2 left-2 right-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 p-3">
          <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700 dark:text-gray-300 truncate max-w-[65%]">{t(conn.name)}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  conn.status === 'connected' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
                  conn.status === 'error' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" :
                  "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                )}>
                  {conn.status === 'connected' ? t('integrations.connected') : conn.status === 'error' ? t('integrations.errorStatus') : t('integrations.disconnected')}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              navigateTo('connections');
              setIsMobileConnectionsOpen(false);
            }}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('dashboard.manageConnections')}
          </button>
        </div>
      )}
    </header>
  );
}
