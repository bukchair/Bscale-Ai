import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Bell, Search, User, ChevronDown, CheckCircle, AlertTriangle, Calendar, BrainCircuit, LifeBuoy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange, DateRangeType } from '../contexts/DateRangeContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { cn } from '../lib/utils';
import { collection, collectionGroup, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type UserProfile = {
  uid?: string;
  role?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  trialStartedAt?: string;
  createdAt?: string;
  name?: string;
  email?: string;
};

interface HeaderProps {
  onMenuClick: () => void;
  userProfile?: UserProfile;
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

type SupportThreadNotification = {
  id: string;
  ownerUid: string;
  docId: string;
  kind?: 'support_thread';
  subject: string;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string;
  status?: string;
  updatedAt?: string;
  lastMessageAt?: string;
  lastMessageFrom?: 'user' | 'admin';
  lastMessageText?: string;
  adminSeenAt?: string;
  userSeenAt?: string;
  messages?: SupportMessageRow[];
};

type SupportMessageRow = {
  id: string;
  threadId: string;
  text: string;
  senderUid: string;
  senderRole: 'user' | 'admin';
  senderName?: string;
  createdAt: string;
};

export function Header({ onMenuClick, userProfile }: HeaderProps) {
  const { t, dir } = useLanguage();
  const { dateRange, setDateRange, customRange, setCustomRange } = useDateRange();
  const { connections, overallQualityScore, connectedCount, totalCount } = useConnections();
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
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
  const [supportNotifications, setSupportNotifications] = useState<SupportThreadNotification[]>([]);
  const [supportThreads, setSupportThreads] = useState<SupportThreadNotification[]>([]);
  const [supportSelectedThreadId, setSupportSelectedThreadId] = useState<string | null>(null);
  const [supportDraftSubject, setSupportDraftSubject] = useState('');
  const [supportDraftMessage, setSupportDraftMessage] = useState('');
  const [supportReply, setSupportReply] = useState('');
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
  const [isSupportSending, setIsSupportSending] = useState(false);
  const isDemo = userProfile?.subscriptionStatus === 'demo';
  const isTrialUser = userProfile?.subscriptionStatus === 'trial' && userProfile?.role !== 'admin';
  const canViewLeads = userProfile?.role === 'admin';
  const canApproveUsers = userProfile?.role === 'admin';
  const canViewSupport = userProfile?.role === 'admin';
  const currentUid = auth.currentUser?.uid;
  const supportCurrentUid = auth.currentUser?.uid || userProfile?.uid || '';
  const previousNewestLeadRef = useRef<string | null>(null);
  const previousNewestPendingUserRef = useRef<string | null>(null);
  const previousNewestSupportRef = useRef<string | null>(null);
  const hasInitializedLeadFeed = useRef(false);
  const hasInitializedPendingFeed = useRef(false);
  const hasInitializedSupportFeed = useRef(false);
  const dateRangeRef = useRef<HTMLDivElement | null>(null);
  const connectionsRef = useRef<HTMLDivElement | null>(null);
  const supportRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const [liveSupportToast, setLiveSupportToast] = useState<{ id: string; subject: string; user: string } | null>(null);
  const [trialNowMs, setTrialNowMs] = useState(() => Date.now());

  const tr = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const trialEndsAtMs = useMemo(() => {
    if (!isTrialUser) return 0;
    const trialEndsAtRaw = userProfile?.trialEndsAt;
    const endsMs = Date.parse(String(trialEndsAtRaw || ''));
    if (Number.isFinite(endsMs)) return endsMs;

    // Fallback for older profiles that might not include trialEndsAt.
    const startedMs = Date.parse(String(userProfile?.trialStartedAt || userProfile?.createdAt || ''));
    if (!Number.isFinite(startedMs)) return 0;
    return startedMs + 3 * 24 * 60 * 60 * 1000;
  }, [isTrialUser, userProfile?.createdAt, userProfile?.trialEndsAt, userProfile?.trialStartedAt]);

  const trialRemainingMs = useMemo(() => {
    if (!trialEndsAtMs) return 0;
    return Math.max(0, trialEndsAtMs - trialNowMs);
  }, [trialEndsAtMs, trialNowMs]);

  const trialCountdownLabel = useMemo(() => {
    if (!isTrialUser) return '';
    if (trialRemainingMs <= 0) {
      return dir === 'rtl' ? 'הסתיים' : 'Expired';
    }
    const totalMinutes = Math.floor(trialRemainingMs / (60 * 1000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return dir === 'rtl'
        ? `${days} ימים ${hours} שעות`
        : `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return dir === 'rtl'
        ? `${hours} שעות ${minutes} דק׳`
        : `${hours}h ${minutes}m`;
    }
    return dir === 'rtl' ? `${minutes} דק׳` : `${minutes}m`;
  }, [dir, isTrialUser, trialRemainingMs]);

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

  useEffect(() => {
    if (!canViewSupport) {
      setSupportNotifications([]);
      return;
    }

    const supportQuery = query(collectionGroup(db, 'settings'), where('kind', '==', 'support_thread'), limit(50));
    const unsubscribe = onSnapshot(
      supportQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((threadDoc) => {
            const ownerUid = threadDoc.ref.parent.parent?.id || '';
            return {
              id: threadDoc.id,
              docId: threadDoc.id,
              ownerUid,
              ...(threadDoc.data() as any),
            } as SupportThreadNotification;
          })
          .filter((row) => Boolean(row.ownerUid))
          .sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.lastMessageAt || 0).getTime();
            const bTime = new Date(b.updatedAt || b.lastMessageAt || 0).getTime();
            return bTime - aTime;
          });
        if (!hasInitializedSupportFeed.current) {
          hasInitializedSupportFeed.current = true;
          previousNewestSupportRef.current = rows[0]?.id || null;
        }
        setSupportNotifications(rows);
      },
      (error) => {
        console.error('Failed to subscribe to support notifications:', error);
      }
    );

    return () => unsubscribe();
  }, [canViewSupport]);

  useEffect(() => {
    if (!supportCurrentUid) {
      setSupportThreads([]);
      setSupportSelectedThreadId(null);
      return;
    }

    const unsubscribe = canViewSupport
      ? onSnapshot(
          query(collectionGroup(db, 'settings'), where('kind', '==', 'support_thread'), limit(50)),
          (snapshot) => {
            const rows = snapshot.docs
              .map((threadDoc) => {
                const ownerUid = threadDoc.ref.parent.parent?.id || '';
                return {
                  id: threadDoc.id,
                  docId: threadDoc.id,
                  ownerUid,
                  ...(threadDoc.data() as any),
                } as SupportThreadNotification;
              })
              .filter((row) => Boolean(row.ownerUid))
              .sort((a, b) => {
                const aTime = new Date(a.updatedAt || a.lastMessageAt || 0).getTime();
                const bTime = new Date(b.updatedAt || b.lastMessageAt || 0).getTime();
                return bTime - aTime;
              });
            setSupportThreads(rows);
            setSupportSelectedThreadId((prev) =>
              prev && rows.some((thread) => thread.id === prev) ? prev : rows[0]?.id || null
            );
          },
          (error) => {
            console.error('Failed to subscribe support widget threads:', error);
          }
        )
      : onSnapshot(
          collection(db, 'users', supportCurrentUid, 'settings'),
          (snapshot) => {
            const rows = snapshot.docs
              .map((threadDoc) => ({
                id: threadDoc.id,
                docId: threadDoc.id,
                ownerUid: supportCurrentUid,
                ...(threadDoc.data() as any),
              }))
              .filter((row) => row.kind === 'support_thread')
              .sort((a, b) => {
                const aTime = new Date((a as any).updatedAt || (a as any).lastMessageAt || 0).getTime();
                const bTime = new Date((b as any).updatedAt || (b as any).lastMessageAt || 0).getTime();
                return bTime - aTime;
              }) as SupportThreadNotification[];
            setSupportThreads(rows);
            setSupportSelectedThreadId((prev) =>
              prev && rows.some((thread) => thread.id === prev) ? prev : rows[0]?.id || null
            );
          },
          (error) => {
            console.error('Failed to subscribe user support widget threads:', error);
          }
        );

    return () => unsubscribe();
  }, [canViewSupport, supportCurrentUid]);

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
    if (!canViewSupport || !hasInitializedSupportFeed.current || supportNotifications.length === 0) return;
    const newestSupport = supportNotifications[0];
    if (!newestSupport) return;
    if (previousNewestSupportRef.current !== newestSupport.id && newestSupport.lastMessageFrom === 'user') {
      setLiveSupportToast({
        id: newestSupport.id,
        subject: newestSupport.subject || tr('notifications.newSupportTitle', 'New support request'),
        user: newestSupport.createdByName || newestSupport.createdByEmail || 'User',
      });
      playLeadAlertSound();
      previousNewestSupportRef.current = newestSupport.id;
    }
  }, [canViewSupport, supportNotifications]);

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

  useEffect(() => {
    if (!liveSupportToast) return;
    const timeout = window.setTimeout(() => setLiveSupportToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [liveSupportToast]);

  useEffect(() => {
    if (!isTrialUser) return;
    setTrialNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setTrialNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [isTrialUser]);

  const handleApproveUserNoPayment = async (
    userId: string,
    mode: 'active' | 'free' = 'active'
  ) => {
    if (!currentUid) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscriptionStatus: mode,
        plan: mode === 'active' ? 'granted_by_admin' : 'free_by_admin',
        approvedByAdminUid: currentUid,
        approvedAt: new Date().toISOString(),
        trialStartedAt: null,
        trialEndsAt: null,
        trialExpiredAt: null,
      });
    } catch (error) {
      console.error('Failed to approve user to a no-payment subscription:', error);
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

  const selectedSupportThread = useMemo(
    () => supportThreads.find((thread) => thread.id === supportSelectedThreadId) || null,
    [supportSelectedThreadId, supportThreads]
  );

  const selectedSupportMessages = useMemo(() => {
    if (!selectedSupportThread?.messages) return [];
    return selectedSupportThread.messages.slice().sort((a, b) => {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }, [selectedSupportThread]);

  const unreadSupportWidgetCount = useMemo(() => {
    return supportThreads.filter((thread) => {
      const lastAt = thread.lastMessageAt ? new Date(thread.lastMessageAt).getTime() : 0;
      const seenAt = canViewSupport
        ? (thread.adminSeenAt ? new Date(thread.adminSeenAt).getTime() : 0)
        : (thread.userSeenAt ? new Date(thread.userSeenAt).getTime() : 0);
      const expectedSender: 'user' | 'admin' = canViewSupport ? 'user' : 'admin';
      return thread.lastMessageFrom === expectedSender && lastAt > seenAt;
    }).length;
  }, [canViewSupport, supportThreads]);

  const unreadSupportCount = useMemo(() => {
    if (!canViewSupport) return 0;
    return supportNotifications.filter((thread) => {
      if (thread.lastMessageFrom !== 'user') return false;
      const lastAt = thread.lastMessageAt ? new Date(thread.lastMessageAt).getTime() : 0;
      const seenAt = thread.adminSeenAt ? new Date(thread.adminSeenAt).getTime() : 0;
      return lastAt > seenAt;
    }).length;
  }, [canViewSupport, supportNotifications]);

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
        actionLabel: tr('notifications.approveNoPaymentAction', 'אשר מנוי ללא תשלום'),
        actionClassName:
          'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100',
        onAction: () => handleApproveUserNoPayment(pendingUser.uid, 'active'),
      })),
    [currentUid, dir, pendingUserApprovals]
  );
  const supportNotificationItems = useMemo(
    () =>
      supportNotifications.map((thread) => {
        const lastAt = thread.lastMessageAt ? new Date(thread.lastMessageAt).getTime() : 0;
        const seenAt = thread.adminSeenAt ? new Date(thread.adminSeenAt).getTime() : 0;
        return {
          id: `support-${thread.id}`,
          type: 'support',
          title: tr('notifications.newSupportTitle', 'New support request'),
          desc: `${thread.createdByName || thread.createdByEmail || 'User'} • ${thread.subject || 'Support'}`,
          time: thread.lastMessageAt
            ? new Date(thread.lastMessageAt).toLocaleString(dir === 'rtl' ? 'he-IL' : 'en-US')
            : '--',
          icon: LifeBuoy,
          color: 'text-blue-600',
          unread: thread.lastMessageFrom === 'user' ? lastAt > seenAt : false,
          actionLabel: tr('notifications.openSupportInbox', 'Open support inbox'),
          actionClassName: 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100',
          onAction: () => {
            window.history.pushState({}, '', '/support');
            window.dispatchEvent(new PopStateEvent('popstate'));
            setIsNotificationsOpen(false);
          },
        } as NotificationItem;
      }),
    [dir, supportNotifications]
  );

  const notifications: NotificationItem[] = canViewLeads
    ? [...pendingUserNotificationItems, ...supportNotificationItems, ...leadNotificationItems]
    : fallbackNotifications.map((item) => ({ ...item, unread: false }));
  const unreadNotificationsCount = unreadLeadCount + unreadPendingUserCount + unreadSupportCount;

  useEffect(() => {
    if (!isDatePickerOpen && !isConnectionsOpen && !isSupportOpen && !isNotificationsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const containers = [dateRangeRef.current, connectionsRef.current, supportRef.current, notificationsRef.current].filter(
        Boolean
      ) as HTMLElement[];
      const clickedInsideAnyBubble = containers.some((container) => container.contains(target));
      if (clickedInsideAnyBubble) return;

      setIsDatePickerOpen(false);
      setIsConnectionsOpen(false);
      setIsSupportOpen(false);
      setIsNotificationsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsDatePickerOpen(false);
      setIsConnectionsOpen(false);
      setIsSupportOpen(false);
      setIsNotificationsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isConnectionsOpen, isDatePickerOpen, isNotificationsOpen, isSupportOpen]);

  const handleToggleNotifications = async () => {
    const nextState = !isNotificationsOpen;
    setIsNotificationsOpen(nextState);
    if (nextState) setIsSupportOpen(false);
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

    const unreadSupportThreads = supportNotifications.filter((thread) => {
      if (thread.lastMessageFrom !== 'user') return false;
      const lastAt = thread.lastMessageAt ? new Date(thread.lastMessageAt).getTime() : 0;
      const seenAt = thread.adminSeenAt ? new Date(thread.adminSeenAt).getTime() : 0;
      return lastAt > seenAt;
    });

    await Promise.all(
      unreadSupportThreads.map((thread) =>
        updateDoc(doc(db, 'users', thread.ownerUid, 'settings', thread.docId), {
          adminSeenAt: new Date().toISOString(),
        }).catch((error) => {
          console.warn('Failed to mark support notification as read:', error);
        })
      )
    );
  };

  const getSupportThreadDocRef = (thread: SupportThreadNotification) => {
    return doc(db, 'users', thread.ownerUid || thread.createdByUid || '', 'settings', thread.docId || thread.id);
  };

  const handleToggleSupport = () => {
    setIsSupportOpen((prev) => !prev);
    setSupportError(null);
    setSupportSuccess(null);
    setIsNotificationsOpen(false);
  };

  useEffect(() => {
    if (!isSupportOpen || !selectedSupportThread) return;
    const markSeen = async () => {
      try {
        const lastAt = selectedSupportThread.lastMessageAt
          ? new Date(selectedSupportThread.lastMessageAt).getTime()
          : 0;
        if (!lastAt) return;
        const field = canViewSupport ? 'adminSeenAt' : 'userSeenAt';
        const seenAtRaw = canViewSupport ? selectedSupportThread.adminSeenAt : selectedSupportThread.userSeenAt;
        const seenAt = seenAtRaw ? new Date(seenAtRaw).getTime() : 0;
        if (seenAt >= lastAt) return;
        await updateDoc(getSupportThreadDocRef(selectedSupportThread), { [field]: new Date().toISOString() });
      } catch (error) {
        console.warn('Failed to mark support widget thread as seen:', error);
      }
    };
    markSeen();
  }, [canViewSupport, isSupportOpen, selectedSupportThread]);

  const handleSupportSend = async () => {
    if (!supportCurrentUid) {
      setSupportError(tr('support.authRequired', 'You must be logged in to use support.'));
      return;
    }

    const now = new Date().toISOString();
    setSupportError(null);
    setSupportSuccess(null);
    setIsSupportSending(true);

    try {
      if (selectedSupportThread) {
        const clean = supportReply.trim();
        if (!clean) {
          setSupportError(tr('support.messageRequired', 'Message is required.'));
          setIsSupportSending(false);
          return;
        }
        const senderRole: 'user' | 'admin' = canViewSupport ? 'admin' : 'user';
        const nextMessage: SupportMessageRow = {
          id: `msg_${Date.now()}`,
          threadId: selectedSupportThread.id,
          text: clean.slice(0, 4000),
          senderUid: supportCurrentUid,
          senderRole,
          senderName: auth.currentUser?.displayName || userProfile?.name || (canViewSupport ? 'Admin' : 'User'),
          createdAt: now,
        };
        await updateDoc(getSupportThreadDocRef(selectedSupportThread), {
          messages: [...(selectedSupportThread.messages || []), nextMessage],
          updatedAt: now,
          lastMessageAt: now,
          lastMessageFrom: senderRole,
          lastMessageText: clean.slice(0, 300),
          status: senderRole === 'admin' ? 'waiting-user' : 'waiting-admin',
          ...(senderRole === 'admin' ? { adminSeenAt: now } : { userSeenAt: now }),
        });
        setSupportReply('');
        setSupportSuccess(tr('support.messageSent', 'Message sent.'));
      } else {
        if (canViewSupport) {
          setSupportError(tr('support.selectThread', 'Select a support request first.'));
          setIsSupportSending(false);
          return;
        }
        const cleanSubject = supportDraftSubject.trim();
        const cleanMessage = supportDraftMessage.trim();
        if (!cleanSubject) {
          setSupportError(tr('support.subjectRequired', 'Subject is required.'));
          setIsSupportSending(false);
          return;
        }
        if (!cleanMessage) {
          setSupportError(tr('support.messageRequired', 'Message is required.'));
          setIsSupportSending(false);
          return;
        }

        const threadRef = doc(collection(db, 'users', supportCurrentUid, 'settings'));
        const firstMessage: SupportMessageRow = {
          id: `msg_${Date.now()}`,
          threadId: threadRef.id,
          text: cleanMessage.slice(0, 4000),
          senderUid: supportCurrentUid,
          senderRole: 'user',
          senderName: auth.currentUser?.displayName || userProfile?.name || 'User',
          createdAt: now,
        };

        await setDoc(threadRef, {
          kind: 'support_thread',
          subject: cleanSubject.slice(0, 180),
          createdByUid: supportCurrentUid,
          createdByName: auth.currentUser?.displayName || userProfile?.name || 'User',
          createdByEmail: auth.currentUser?.email || userProfile?.email || '',
          createdAt: now,
          updatedAt: now,
          status: 'waiting-admin',
          lastMessageAt: now,
          lastMessageFrom: 'user',
          lastMessageText: cleanMessage.slice(0, 300),
          adminSeenAt: '',
          userSeenAt: now,
          messages: [firstMessage],
        });
        setSupportDraftSubject('');
        setSupportDraftMessage('');
        setSupportSelectedThreadId(threadRef.id);
        setSupportSuccess(tr('support.requestSent', 'Support request sent.'));
      }
    } catch (error) {
      console.error('Support widget send failed:', error);
      setSupportError(tr('support.sendFailed', 'Failed to send support message.'));
    } finally {
      setIsSupportSending(false);
    }
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
    <header className="bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/10 min-h-16 py-2 flex items-center justify-between px-3 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="flex items-center flex-1 gap-2 sm:gap-3 min-w-0">
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

        <div ref={dateRangeRef} className="hidden sm:flex items-center gap-2 relative ms-2">
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
            <div className="absolute top-full mt-2 left-0 w-[calc(100vw-2rem)] max-w-[520px] sm:w-auto bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
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

          <div ref={connectionsRef} className="relative ms-4">
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
              <div className={cn("absolute top-full mt-2 w-[calc(100vw-1rem)] max-w-80 sm:w-80 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 p-4", dir === 'rtl' ? "right-0" : "left-0")}>
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

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {isTrialUser && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="whitespace-nowrap">
              {dir === 'rtl' ? 'ימי ניסיון:' : 'Trial:'}
            </span>
            <span className="whitespace-nowrap text-indigo-900">{trialCountdownLabel}</span>
          </div>
        )}
        <ThemeSwitcher />
        <LanguageSwitcher />

        <div ref={supportRef} className="relative">
          <button
            onClick={handleToggleSupport}
            className={cn(
              "p-2 rounded-lg transition-colors relative",
              isSupportOpen ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white" : "text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            )}
            title={tr('notifications.openSupportInbox', 'תמיכה טכנית')}
          >
            <LifeBuoy className="w-6 h-6" />
            {unreadSupportWidgetCount > 0 && (
              <span className="absolute top-1.5 end-1.5 block w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#111]" />
            )}
          </button>

          {isSupportOpen && (
            <div
              className={cn(
                "absolute top-full mt-2 w-[calc(100vw-1rem)] max-w-[360px] sm:w-[360px] bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 overflow-hidden",
                dir === 'rtl' ? "left-0" : "right-0"
              )}
            >
              <div className="p-3 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {tr('notifications.openSupportInbox', 'תמיכה טכנית')}
                  </h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {canViewSupport
                      ? tr('support.adminMini', 'חלון מענה מהיר לפניות משתמשים')
                      : tr('support.userMini', 'שליחת פנייה מהירה לצוות התמיכה')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    window.history.pushState({}, '', '/support');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                    setIsSupportOpen(false);
                  }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {tr('support.openFull', 'פתח מלא')}
                </button>
              </div>

              <div className="p-3 space-y-3">
                {supportThreads.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {supportThreads.map((thread) => {
                      const lastAt = thread.lastMessageAt ? new Date(thread.lastMessageAt).getTime() : 0;
                      const seenAt = canViewSupport
                        ? (thread.adminSeenAt ? new Date(thread.adminSeenAt).getTime() : 0)
                        : (thread.userSeenAt ? new Date(thread.userSeenAt).getTime() : 0);
                      const expectedSender: 'user' | 'admin' = canViewSupport ? 'user' : 'admin';
                      const unread = thread.lastMessageFrom === expectedSender && lastAt > seenAt;
                      return (
                        <button
                          key={`support-mini-${thread.id}`}
                          onClick={() => setSupportSelectedThreadId(thread.id)}
                          className={cn(
                            'w-full rounded-lg border px-2.5 py-2 text-xs text-start transition-colors',
                            supportSelectedThreadId === thread.id
                              ? 'border-indigo-300 bg-indigo-50/70 dark:bg-indigo-500/10 dark:border-indigo-400/50'
                              : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-gray-800 dark:text-gray-100 truncate">
                              {thread.subject || tr('support.noSubject', 'ללא נושא')}
                            </span>
                            {unread && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          </div>
                          <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {thread.lastMessageText || tr('support.noMessages', 'אין הודעות עדיין')}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedSupportThread ? (
                  <>
                    <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg border border-gray-200 dark:border-white/10 p-2">
                      {selectedSupportMessages.length > 0 ? (
                        selectedSupportMessages.map((message) => {
                          const mine = message.senderUid === supportCurrentUid;
                          return (
                            <div
                              key={`mini-msg-${selectedSupportThread.id}-${message.id}`}
                              className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                            >
                              <div
                                className={cn(
                                  'max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px]',
                                  mine
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100'
                                )}
                              >
                                {message.text}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {tr('support.noMessages', 'אין הודעות עדיין')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={supportReply}
                        onChange={(event) => setSupportReply(event.target.value)}
                        placeholder={tr('support.replyPlaceholder', 'כתוב תגובה מהירה...')}
                        className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <button
                        onClick={handleSupportSend}
                        disabled={isSupportSending}
                        className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {tr('support.send', 'שלח')}
                      </button>
                    </div>
                  </>
                ) : canViewSupport ? (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {tr('support.selectThread', 'בחר פנייה כדי להגיב')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={supportDraftSubject}
                      onChange={(event) => setSupportDraftSubject(event.target.value)}
                      placeholder={tr('support.subject', 'נושא הפנייה')}
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <textarea
                      value={supportDraftMessage}
                      onChange={(event) => setSupportDraftMessage(event.target.value)}
                      placeholder={tr('support.message', 'תאר בקצרה את הבעיה')}
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                    />
                    <button
                      onClick={handleSupportSend}
                      disabled={isSupportSending}
                      className="w-full h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {tr('support.sendRequest', 'שלח פנייה')}
                    </button>
                  </div>
                )}

                {supportError && <p className="text-[11px] text-red-500">{supportError}</p>}
                {supportSuccess && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{supportSuccess}</p>}
              </div>
            </div>
          )}
        </div>
        
        <div ref={notificationsRef} className="relative">
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
              "absolute top-full mt-2 w-[calc(100vw-1rem)] max-w-[420px] sm:w-96 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg z-50 overflow-hidden",
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
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
                    <button
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      onClick={() => {
                        window.history.pushState({}, '', '/support');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        setIsNotificationsOpen(false);
                      }}
                    >
                      {tr('notifications.openSupportInbox', 'תמיכה טכנית')}
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
      {liveSupportToast && (
        <div className={cn("fixed top-52 z-[90] w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[320px]", dir === 'rtl' ? 'left-4 sm:left-6' : 'right-4 sm:right-6')}>
          <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-blue-500">
            <p className="text-xs font-black uppercase tracking-wider mb-1">
              {tr('notifications.newSupportTitle', 'פניית תמיכה חדשה')}
            </p>
            <p className="text-sm font-bold">{liveSupportToast.subject}</p>
            <p className="text-xs text-blue-100">{liveSupportToast.user}</p>
          </div>
        </div>
      )}
    </header>
  );
}
