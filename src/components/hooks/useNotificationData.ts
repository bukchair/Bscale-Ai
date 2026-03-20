/**
 * Manages all real-time Firebase notification subscriptions for the Header:
 *   - Sales leads
 *   - Pending user approvals
 *   - Support threads (admin view + user view)
 *
 * Extracted from Header.tsx to keep the component focused on layout/JSX.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  collectionGroup,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PendingUserApproval = {
  uid: string;
  name: string;
  email: string;
  createdAt?: string;
  role?: string;
  subscriptionStatus?: string;
  approvalReadBy?: Record<string, string>;
};

export type SupportMessageRow = {
  id: string;
  threadId: string;
  text: string;
  senderUid: string;
  senderRole: 'user' | 'admin';
  senderName?: string;
  createdAt: string;
};

export type SupportThreadNotification = {
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

export type LeadNotification = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  sourcePath?: string;
  readBy?: Record<string, string>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface Options {
  canViewLeads: boolean;
  canApproveUsers: boolean;
  canViewSupport: boolean;
  currentUid: string | undefined;
  supportCurrentUid: string;
}

const playAlertSound = () => {
  try {
    const AudioCtx =
      (window as unknown as Record<string, unknown>).AudioContext as typeof AudioContext ||
      (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
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
  } catch {
    /* non-fatal */
  }
};

export function useNotificationData({
  canViewLeads,
  canApproveUsers,
  canViewSupport,
  currentUid,
  supportCurrentUid,
}: Options) {
  const [leadNotifications, setLeadNotifications] = useState<LeadNotification[]>([]);
  const [pendingUserApprovals, setPendingUserApprovals] = useState<PendingUserApproval[]>([]);
  const [supportNotifications, setSupportNotifications] = useState<SupportThreadNotification[]>([]);
  const [supportThreads, setSupportThreads] = useState<SupportThreadNotification[]>([]);
  const [supportSelectedThreadId, setSupportSelectedThreadId] = useState<string | null>(null);

  const [liveLeadToast, setLiveLeadToast] = useState<{
    id: string; name: string; contact: string;
  } | null>(null);
  const [livePendingUserToast, setLivePendingUserToast] = useState<{
    uid: string; name: string; email: string;
  } | null>(null);
  const [liveSupportToast, setLiveSupportToast] = useState<{
    id: string; subject: string; user: string;
  } | null>(null);

  const previousNewestLeadRef = useRef<string | null>(null);
  const previousNewestPendingUserRef = useRef<string | null>(null);
  const previousNewestSupportRef = useRef<string | null>(null);
  const hasInitializedLeadFeed = useRef(false);
  const hasInitializedPendingFeed = useRef(false);
  const hasInitializedSupportFeed = useRef(false);

  // ── Firebase: leads ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canViewLeads) { setLeadNotifications([]); return; }
    const q = query(collection(db, 'salesLeads'), orderBy('createdAt', 'desc'), limit(25));
    return onSnapshot(
      q,
      (snapshot) => {
        const leads = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeadNotification, 'id'>) }));
        if (!hasInitializedLeadFeed.current) {
          hasInitializedLeadFeed.current = true;
          previousNewestLeadRef.current = leads[0]?.id || null;
        }
        setLeadNotifications(leads);
      },
      (err) => console.error('[notifications] leads subscription error:', err)
    );
  }, [canViewLeads]);

  // ── Firebase: pending user approvals ────────────────────────────────────────
  useEffect(() => {
    if (!canApproveUsers) { setPendingUserApprovals([]); return; }
    const q = query(collection(db, 'users'), where('subscriptionStatus', '==', 'demo'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const users = snapshot.docs
          .map((d) => ({ uid: d.id, ...(d.data() as Omit<PendingUserApproval, 'uid'>) }))
          .filter((u) => u.role !== 'admin')
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        if (!hasInitializedPendingFeed.current) {
          hasInitializedPendingFeed.current = true;
          previousNewestPendingUserRef.current = users[0]?.uid || null;
        }
        setPendingUserApprovals(users);
      },
      (err) => console.error('[notifications] pending users subscription error:', err)
    );
  }, [canApproveUsers]);

  // ── Firebase: support notifications (admin bell) ────────────────────────────
  useEffect(() => {
    if (!canViewSupport) { setSupportNotifications([]); return; }
    const q = query(collectionGroup(db, 'settings'), where('kind', '==', 'support_thread'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs
          .map((d) => ({ id: d.id, docId: d.id, ownerUid: d.ref.parent.parent?.id || '', ...(d.data() as object) } as SupportThreadNotification))
          .filter((r) => Boolean(r.ownerUid))
          .sort((a, b) => new Date(b.updatedAt || b.lastMessageAt || 0).getTime() - new Date(a.updatedAt || a.lastMessageAt || 0).getTime());
        if (!hasInitializedSupportFeed.current) {
          hasInitializedSupportFeed.current = true;
          previousNewestSupportRef.current = rows[0]?.id || null;
        }
        setSupportNotifications(rows);
      },
      (err) => console.error('[notifications] support notifications subscription error:', err)
    );
  }, [canViewSupport]);

  // ── Firebase: support widget threads (user + admin) ─────────────────────────
  useEffect(() => {
    if (!supportCurrentUid) {
      setSupportThreads([]);
      setSupportSelectedThreadId(null);
      return;
    }

    const sort = (rows: SupportThreadNotification[]) =>
      rows.sort((a, b) =>
        new Date(b.updatedAt || b.lastMessageAt || 0).getTime() -
        new Date(a.updatedAt || a.lastMessageAt || 0).getTime()
      );

    const setAndAutoSelect = (rows: SupportThreadNotification[]) => {
      setSupportThreads(rows);
      setSupportSelectedThreadId((prev) =>
        prev && rows.some((t) => t.id === prev) ? prev : rows[0]?.id || null
      );
    };

    const q = canViewSupport
      ? query(collectionGroup(db, 'settings'), where('kind', '==', 'support_thread'), limit(50))
      : collection(db, 'users', supportCurrentUid, 'settings');

    return onSnapshot(
      q,
      (snapshot) => {
        const rows = canViewSupport
          ? snapshot.docs
              .map((d) => ({ id: d.id, docId: d.id, ownerUid: d.ref.parent.parent?.id || '', ...(d.data() as object) } as SupportThreadNotification))
              .filter((r) => Boolean(r.ownerUid))
          : snapshot.docs
              .map((d) => ({ id: d.id, docId: d.id, ownerUid: supportCurrentUid, ...(d.data() as object) } as SupportThreadNotification))
              .filter((r) => r.kind === 'support_thread');
        setAndAutoSelect(sort(rows));
      },
      (err) => console.error('[notifications] support widget subscription error:', err)
    );
  }, [canViewSupport, supportCurrentUid]);

  // ── Toast triggers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canViewLeads || !hasInitializedLeadFeed.current || leadNotifications.length === 0) return;
    const newest = leadNotifications[0];
    if (previousNewestLeadRef.current === newest.id) return;
    const contact = newest.email || newest.phone || '';
    setLiveLeadToast({ id: newest.id, name: newest.name, contact });
    playAlertSound();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('ליד חדש מהאתר', { body: `${newest.name} • ${contact}` });
    }
    previousNewestLeadRef.current = newest.id;
  }, [canViewLeads, leadNotifications]);

  useEffect(() => {
    if (!canApproveUsers || !hasInitializedPendingFeed.current || pendingUserApprovals.length === 0) return;
    const newest = pendingUserApprovals[0];
    if (previousNewestPendingUserRef.current === newest.uid) return;
    setLivePendingUserToast({ uid: newest.uid, name: newest.name || 'User', email: newest.email || '—' });
    playAlertSound();
    previousNewestPendingUserRef.current = newest.uid;
  }, [canApproveUsers, pendingUserApprovals]);

  useEffect(() => {
    if (!canViewSupport || !hasInitializedSupportFeed.current || supportNotifications.length === 0) return;
    const newest = supportNotifications[0];
    if (!newest || previousNewestSupportRef.current === newest.id || newest.lastMessageFrom !== 'user') return;
    setLiveSupportToast({ id: newest.id, subject: newest.subject || '', user: newest.createdByName || newest.createdByEmail || 'User' });
    playAlertSound();
    previousNewestSupportRef.current = newest.id;
  }, [canViewSupport, supportNotifications]);

  // ── Toast auto-dismiss ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!liveLeadToast) return;
    const t = window.setTimeout(() => setLiveLeadToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [liveLeadToast]);

  useEffect(() => {
    if (!livePendingUserToast) return;
    const t = window.setTimeout(() => setLivePendingUserToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [livePendingUserToast]);

  useEffect(() => {
    if (!liveSupportToast) return;
    const t = window.setTimeout(() => setLiveSupportToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [liveSupportToast]);

  // ── Derived: unread counts ──────────────────────────────────────────────────
  const unreadLeadCount = useMemo(
    () => (currentUid ? leadNotifications.filter((l) => !l.readBy?.[currentUid]).length : 0),
    [currentUid, leadNotifications]
  );
  const unreadPendingUserCount = useMemo(
    () => (currentUid ? pendingUserApprovals.filter((u) => !u.approvalReadBy?.[currentUid]).length : 0),
    [currentUid, pendingUserApprovals]
  );
  const unreadSupportCount = useMemo(() => {
    if (!canViewSupport) return 0;
    return supportNotifications.filter((t) => {
      if (t.lastMessageFrom !== 'user') return false;
      const lastAt = t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : 0;
      return lastAt > (t.adminSeenAt ? new Date(t.adminSeenAt).getTime() : 0);
    }).length;
  }, [canViewSupport, supportNotifications]);

  const unreadSupportWidgetCount = useMemo(() => {
    return supportThreads.filter((t) => {
      const lastAt = t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : 0;
      const seenAt = canViewSupport
        ? (t.adminSeenAt ? new Date(t.adminSeenAt).getTime() : 0)
        : (t.userSeenAt ? new Date(t.userSeenAt).getTime() : 0);
      const expectedSender: 'user' | 'admin' = canViewSupport ? 'user' : 'admin';
      return t.lastMessageFrom === expectedSender && lastAt > seenAt;
    }).length;
  }, [canViewSupport, supportThreads]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleApproveUserNoPayment = async (userId: string, mode: 'active' | 'free' = 'active') => {
    if (!auth.currentUser?.uid) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscriptionStatus: mode,
        plan: mode === 'active' ? 'granted_by_admin' : 'free_by_admin',
        approvedByAdminUid: auth.currentUser.uid,
        approvedAt: new Date().toISOString(),
        trialStartedAt: null,
        trialEndsAt: null,
        trialExpiredAt: null,
      });
    } catch (err) {
      console.error('[notifications] Failed to approve user:', err);
    }
  };

  const markNotificationsRead = async () => {
    if (!currentUid || !canViewLeads) return;
    const unreadLeads = leadNotifications.filter((l) => !l.readBy?.[currentUid]);
    await Promise.all(
      unreadLeads.map((l) =>
        updateDoc(doc(db, 'salesLeads', l.id), {
          [`readBy.${currentUid}`]: new Date().toISOString(),
        }).catch((err) => console.error('[useNotificationData] markLead read failed:', err))
      )
    );
    const unreadPending = pendingUserApprovals.filter((u) => !u.approvalReadBy?.[currentUid]);
    await Promise.all(
      unreadPending.map((u) =>
        updateDoc(doc(db, 'users', u.uid), {
          [`approvalReadBy.${currentUid}`]: new Date().toISOString(),
        }).catch((err) => console.error('[useNotificationData] markApproval read failed:', err))
      )
    );
    const unreadSupport = supportNotifications.filter((t) => {
      if (t.lastMessageFrom !== 'user') return false;
      return (t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : 0) >
             (t.adminSeenAt ? new Date(t.adminSeenAt).getTime() : 0);
    });
    await Promise.all(
      unreadSupport.map((t) =>
        updateDoc(doc(db, 'users', t.ownerUid, 'settings', t.docId), {
          adminSeenAt: new Date().toISOString(),
        }).catch((err) => console.error('[useNotificationData] markSupport seen failed:', err))
      )
    );
  };

  return {
    leadNotifications,
    pendingUserApprovals,
    supportNotifications,
    supportThreads,
    supportSelectedThreadId,
    setSupportSelectedThreadId,
    liveLeadToast,
    livePendingUserToast,
    liveSupportToast,
    unreadLeadCount,
    unreadPendingUserCount,
    unreadSupportCount,
    unreadSupportWidgetCount,
    handleApproveUserNoPayment,
    markNotificationsRead,
  };
}
