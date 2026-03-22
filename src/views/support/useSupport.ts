import { useEffect, useMemo, useState, useCallback } from 'react';
import type { Language } from '../../contexts/LanguageContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SupportStatus = 'open' | 'waiting-admin' | 'waiting-user' | 'resolved';
export type SenderRole = 'user' | 'admin';

export type SupportThreadRow = {
  id: string;
  ownerUid: string;
  docId: string;
  kind?: 'support_thread';
  subject: string;
  createdByUid: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
  status: SupportStatus;
  lastMessageAt: string;
  lastMessageFrom: SenderRole;
  lastMessageText: string;
  adminSeenAt?: string;
  userSeenAt?: string;
  messages?: SupportMessageRow[];
};

export type SupportMessageRow = {
  id: string;
  threadId: string;
  text: string;
  senderUid: string;
  senderRole: SenderRole;
  senderName?: string;
  createdAt: string;
};

type SupportCopy = {
  title: string;
  subtitleUser: string;
  subtitleAdmin: string;
  newRequest: string;
  subject: string;
  firstMessage: string;
  sendRequest: string;
  sending: string;
  myRequests: string;
  allRequests: string;
  noRequests: string;
  chatPlaceholder: string;
  send: string;
  selectRequest: string;
  resolve: string;
  reopen: string;
  statusOpen: string;
  statusWaitingAdmin: string;
  statusWaitingUser: string;
  statusResolved: string;
  createdBy: string;
  validationSubject: string;
  validationMessage: string;
  createError: string;
  sendError: string;
  authRequired: string;
  createSuccess: string;
};

export const COPY: Record<Language, SupportCopy> = {
  he: {
    title: 'תמיכה טכנית',
    subtitleUser: 'כתבו כאן לצוות התמיכה, ונחזיר לכם מענה אמיתי מהממשק.',
    subtitleAdmin: 'תיבת תמיכה מרכזית: קבלת פניות משתמשים ומתן מענה טכני.',
    newRequest: 'פנייה חדשה',
    subject: 'נושא הפנייה',
    firstMessage: 'מה הבעיה או הבקשה?',
    sendRequest: 'שליחת פנייה',
    sending: 'שולח...',
    myRequests: 'הפניות שלי',
    allRequests: 'כל הפניות',
    noRequests: 'אין פניות עדיין.',
    chatPlaceholder: 'הקלד הודעה...',
    send: 'שלח',
    selectRequest: 'בחר פנייה לצפייה',
    resolve: 'סמן כפתור',
    reopen: 'פתח מחדש',
    statusOpen: 'פתוח',
    statusWaitingAdmin: 'ממתין לתמיכה',
    statusWaitingUser: 'ממתין למשתמש',
    statusResolved: 'נפתר',
    createdBy: 'נוצר ע"י',
    validationSubject: 'יש להזין נושא לפנייה.',
    validationMessage: 'יש להזין הודעה ראשונה.',
    createError: 'שגיאה ביצירת פנייה',
    sendError: 'שגיאה בשליחת הודעה',
    authRequired: 'נדרש חיבור לחשבון.',
    createSuccess: 'הפנייה נשלחה. נחזור אליך בהקדם!',
  },
  en: {
    title: 'Technical Support',
    subtitleUser: 'Write here to the support team, and we\'ll respond from the interface.',
    subtitleAdmin: 'Central support inbox: receive user requests and provide technical responses.',
    newRequest: 'New Request',
    subject: 'Subject',
    firstMessage: 'What is the issue or request?',
    sendRequest: 'Send Request',
    sending: 'Sending...',
    myRequests: 'My Requests',
    allRequests: 'All Requests',
    noRequests: 'No requests yet.',
    chatPlaceholder: 'Type a message...',
    send: 'Send',
    selectRequest: 'Select a request to view',
    resolve: 'Mark as Resolved',
    reopen: 'Reopen',
    statusOpen: 'Open',
    statusWaitingAdmin: 'Waiting for Support',
    statusWaitingUser: 'Waiting for User',
    statusResolved: 'Resolved',
    createdBy: 'Created by',
    validationSubject: 'Please enter a subject.',
    validationMessage: 'Please enter a message.',
    createError: 'Error creating request',
    sendError: 'Error sending message',
    authRequired: 'Authentication required.',
    createSuccess: 'Request submitted. We\'ll get back to you shortly!',
  },
  ru: {} as SupportCopy,
  pt: {} as SupportCopy,
  fr: {} as SupportCopy,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseSupportProps {
  userProfile?: { role?: string; uid?: string; name?: string; email?: string | null } | null;
  language: Language;
}

export function useSupport({ userProfile, language }: UseSupportProps) {
  const copy = COPY[language] ?? COPY.en;
  const isAdmin = userProfile?.role === 'admin';
  const currentUid = userProfile?.uid || '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [threads, setThreads] = useState<SupportThreadRow[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [reply, setReply] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Load threads ────────────────────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    if (!currentUid) return;
    try {
      const res = await fetch('/api/support', { credentials: 'include' });
      if (!res.ok) return;
      const d = (await res.json()) as { threads?: SupportThreadRow[] };
      const rows = (d.threads ?? []).sort((a, b) =>
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      setThreads(rows);
      setSelectedThreadId((prev) => prev || rows[0]?.id || null);
    } catch (err) {
      console.error('Failed to load support threads:', err);
    }
  }, [currentUid]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // ── Sync messages from selected thread ──────────────────────────────────────
  useEffect(() => {
    if (!selectedThreadId) { setMessages([]); return; }
    const thread = threads.find((t) => t.id === selectedThreadId);
    const rows = (thread?.messages || []).slice().sort((a, b) =>
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    setMessages(rows);
  }, [selectedThreadId, threads]);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [selectedThreadId, threads]
  );

  // ── Mark seen ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedThread) return;
    const field = isAdmin ? 'adminSeenAt' : 'userSeenAt';
    const seenAt = isAdmin ? selectedThread.adminSeenAt : selectedThread.userSeenAt;
    if (!selectedThread.lastMessageAt) return;
    if (seenAt && new Date(seenAt).getTime() >= new Date(selectedThread.lastMessageAt).getTime()) return;
    fetch(`/api/support/${selectedThread.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ markSeen: true }),
    }).catch((e) => console.warn('Failed to mark support thread as seen:', e));
    setThreads((prev) => prev.map((t) =>
      t.id === selectedThread.id ? { ...t, [field]: new Date().toISOString() } : t
    ));
  }, [isAdmin, selectedThread]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived helpers ────────────────────────────────────────────────────────
  const isUnread = (thread: SupportThreadRow) => {
    if (isAdmin) {
      return (
        thread.lastMessageFrom === 'user' &&
        (!thread.adminSeenAt || new Date(thread.adminSeenAt).getTime() < new Date(thread.lastMessageAt).getTime())
      );
    }
    return (
      thread.lastMessageFrom === 'admin' &&
      (!thread.userSeenAt || new Date(thread.userSeenAt).getTime() < new Date(thread.lastMessageAt).getTime())
    );
  };

  const translateStatus = (status: SupportStatus) => {
    if (status === 'waiting-admin') return copy.statusWaitingAdmin;
    if (status === 'waiting-user') return copy.statusWaitingUser;
    if (status === 'resolved') return copy.statusResolved;
    return copy.statusOpen;
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const createThread = async () => {
    if (!currentUid) { setError(copy.authRequired); return; }
    if (!subject.trim()) { setError(copy.validationSubject); return; }
    if (!firstMessage.trim()) { setError(copy.validationMessage); return; }
    setIsCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject: subject.trim(), firstMessage: firstMessage.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const d = (await res.json()) as { thread?: SupportThreadRow };
      if (d.thread) {
        setThreads((prev) => [d.thread!, ...prev]);
        setSelectedThreadId(d.thread.id);
      }
      setSubject('');
      setFirstMessage('');
      setSuccess(copy.createSuccess);
    } catch (e) {
      console.error('Failed creating support thread:', e);
      setError(copy.createError);
    } finally {
      setIsCreating(false);
    }
  };

  const sendReply = async () => {
    if (!selectedThread) return;
    if (!currentUid) { setError(copy.authRequired); return; }
    const clean = reply.trim();
    if (!clean) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: clean }),
      });
      if (!res.ok) throw new Error('Failed');
      setReply('');
      await loadThreads();
    } catch (e) {
      console.error('Failed sending support reply:', e);
      setError(copy.sendError);
    } finally {
      setIsSending(false);
    }
  };

  const updateThreadStatus = async (status: SupportStatus) => {
    if (!selectedThread || !isAdmin) return;
    try {
      await fetch(`/api/support/${selectedThread.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      setThreads((prev) => prev.map((t) =>
        t.id === selectedThread.id ? { ...t, status, updatedAt: new Date().toISOString() } : t
      ));
    } catch (e) {
      console.error('Failed updating support status:', e);
    }
  };

  return {
    copy,
    isAdmin,
    currentUid,
    threads,
    selectedThreadId, setSelectedThreadId,
    messages,
    subject, setSubject,
    firstMessage, setFirstMessage,
    reply, setReply,
    isCreating,
    isSending,
    error,
    success,
    selectedThread,
    isUnread,
    translateStatus,
    createThread,
    sendReply,
    updateThreadStatus,
  };
}
