"use client";

/**
 * Manages notification data for the Header via polling.
 * Replaces the previous Firebase/Firestore real-time subscriptions.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

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

const POLL_INTERVAL_MS = 30_000; // 30 seconds

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

  // ── Polling: leads ──────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    if (!canViewLeads) { setLeadNotifications([]); return; }
    try {
      const res = await fetch('/api/leads', { credentials: 'include' });
      if (!res.ok) return;
      const d = (await res.json()) as { leads?: LeadNotification[] };
      const leads = (d.leads ?? []).slice(0, 25).sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      if (!hasInitializedLeadFeed.current) {
        hasInitializedLeadFeed.current = true;
        previousNewestLeadRef.current = leads[0]?.id || null;
      }
      setLeadNotifications(leads);
    } catch (err) {
      console.error('[notifications] leads fetch error:', err);
    }
  }, [canViewLeads]);

  // ── Polling: pending user approvals ─────────────────────────────────────────
  const fetchPendingUsers = useCallback(async () => {
    if (!canApproveUsers) { setPendingUserApprovals([]); return; }
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) return;
      const d = (await res.json()) as { users?: PendingUserApproval[] };
      const users = (d.users ?? [])
        .filter((u) => u.subscriptionStatus === 'demo' && u.role !== 'admin')
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      if (!hasInitializedPendingFeed.current) {
        hasInitializedPendingFeed.current = true;
        previousNewestPendingUserRef.current = users[0]?.uid || null;
      }
      setPendingUserApprovals(users);
    } catch (err) {
      console.error('[notifications] pending users fetch error:', err);
    }
  }, [canApproveUsers]);

  // ── Polling: support notifications ──────────────────────────────────────────
  const fetchSupport = useCallback(async () => {
    if (!supportCurrentUid) { setSupportNotifications([]); setSupportThreads([]); return; }
    try {
      const res = await fetch('/api/support', { credentials: 'include' });
      if (!res.ok) return;
      const d = (await res.json()) as { threads?: SupportThreadNotification[] };
      const rows = (d.threads ?? []).sort((a, b) =>
        new Date(b.updatedAt || b.lastMessageAt || 0).getTime() -
        new Date(a.updatedAt || a.lastMessageAt || 0).getTime()
      );
      if (!hasInitializedSupportFeed.current) {
        hasInitializedSupportFeed.current = true;
        previousNewestSupportRef.current = rows[0]?.id || null;
      }
      if (canViewSupport) setSupportNotifications(rows);
      setSupportThreads(rows);
      setSupportSelectedThreadId((prev) =>
        prev && rows.some((t) => t.id === prev) ? prev : rows[0]?.id || null
      );
    } catch (err) {
      console.error('[notifications] support fetch error:', err);
    }
  }, [canViewSupport, supportCurrentUid]);

  // Initial fetch + polling
  useEffect(() => { void fetchLeads(); }, [fetchLeads]);
  useEffect(() => { void fetchPendingUsers(); }, [fetchPendingUsers]);
  useEffect(() => { void fetchSupport(); }, [fetchSupport]);

  useEffect(() => {
    const id = window.setInterval(() => { void fetchLeads(); void fetchPendingUsers(); void fetchSupport(); }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchLeads, fetchPendingUsers, fetchSupport]);

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
    try {
      const nowIso = new Date().toISOString();
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subscriptionStatus: mode,
          plan: mode === 'active' ? 'granted_by_admin' : 'free_by_admin',
          approvedAt: nowIso,
          trialStartedAt: null,
          trialEndsAt: null,
        }),
      });
      setPendingUserApprovals((prev) => prev.filter((u) => u.uid !== userId));
    } catch (err) {
      console.error('[notifications] Failed to approve user:', err);
    }
  };

  const markNotificationsRead = async () => {
    if (!currentUid || !canViewLeads) return;
    const unreadLeads = leadNotifications.filter((l) => !l.readBy?.[currentUid]);
    await Promise.all(
      unreadLeads.map((l) =>
        fetch(`/api/leads/${l.id}/read`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
        }).catch((err) => console.error('[useNotificationData] markLead read failed:', err))
      )
    );
    // Optimistically update local state
    const now = new Date().toISOString();
    setLeadNotifications((prev) =>
      prev.map((l) => (!l.readBy?.[currentUid] ? { ...l, readBy: { ...(l.readBy ?? {}), [currentUid]: now } } : l))
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
