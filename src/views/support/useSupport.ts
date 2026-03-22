import { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
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
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || userProfile?.uid || '';
  const currentDisplayName = currentUser?.displayName || userProfile?.name || 'User';
  const currentEmail = currentUser?.email || userProfile?.email || '';

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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const mapFirebaseError = (raw: unknown, fallback: string) => {
    const message = raw instanceof Error ? raw.message : '';
    if (/permission|denied|missing or insufficient/i.test(message)) {
      return language === 'he' ? 'אין הרשאת כתיבה לתמיכה בחשבון הנוכחי.' : `${fallback} (permission denied)`;
    }
    return fallback;
  };

  const getThreadDocRef = (thread: SupportThreadRow) => {
    return doc(db, 'users', thread.ownerUid || thread.createdByUid, 'settings', thread.docId || thread.id);
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUid) return;

    const unsubscribe = isAdmin
      ? onSnapshot(
          query(collectionGroup(db, 'settings'), where('kind', '==', 'support_thread')),
          (snapshot) => {
            const rows = snapshot.docs
              .map((row) => {
                const ownerUid = row.ref.parent.parent?.id || '';
                return {
                  id: row.id,
                  ownerUid,
                  docId: row.id,
                  ...(row.data() as Record<string, unknown>),
                } as SupportThreadRow;
              })
              .filter((row) => Boolean(row.ownerUid))
              .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
            setThreads(rows);
            setSelectedThreadId((prev) => prev || rows[0]?.id || null);
          },
          (snapshotError) => {
            console.error('Failed to load support threads:', snapshotError);
          }
        )
      : onSnapshot(
          collection(db, 'users', currentUid, 'settings'),
          (snapshot) => {
            const rows = snapshot.docs
              .map((row) => ({
                id: row.id,
                ownerUid: currentUid,
                docId: row.id,
                ...(row.data() as Record<string, unknown>),
              } as SupportThreadRow))
              .filter((row) => row.kind === 'support_thread')
              .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()) as SupportThreadRow[];
            setThreads(rows);
            setSelectedThreadId((prev) => prev || rows[0]?.id || null);
          },
          (snapshotError) => {
            console.error('Failed to load support threads:', snapshotError);
          }
        );

    return () => unsubscribe();
  }, [currentUid, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }
    const thread = threads.find((item) => item.id === selectedThreadId);
    const rows = (thread?.messages || []).slice().sort((a, b) => {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
    setMessages(rows);
  }, [selectedThreadId, threads]);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [selectedThreadId, threads]
  );

  // ── Effect: mark seen ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedThread) return;
    const markSeen = async () => {
      try {
        const field = isAdmin ? 'adminSeenAt' : 'userSeenAt';
        const seenAt = isAdmin ? selectedThread.adminSeenAt : selectedThread.userSeenAt;
        if (!selectedThread.lastMessageAt) return;
        if (seenAt && new Date(seenAt).getTime() >= new Date(selectedThread.lastMessageAt).getTime()) return;
        await updateDoc(getThreadDocRef(selectedThread), { [field]: new Date().toISOString() });
      } catch (updateError) {
        console.warn('Failed to mark support thread as seen:', updateError);
      }
    };
    markSeen();
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
    if (!currentUid) {
      setError(copy.authRequired);
      return;
    }
    if (!subject.trim()) {
      setError(copy.validationSubject);
      return;
    }
    if (!firstMessage.trim()) {
      setError(copy.validationMessage);
      return;
    }
    setIsCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const now = new Date().toISOString();
      const threadRef = doc(collection(db, 'users', currentUid, 'settings'));
      const firstSupportMessage: SupportMessageRow = {
        id: `msg_${Date.now()}`,
        threadId: threadRef.id,
        text: firstMessage.trim().slice(0, 4000),
        senderUid: currentUid,
        senderRole: 'user',
        senderName: currentDisplayName,
        createdAt: now,
      };

      await setDoc(threadRef, {
        kind: 'support_thread',
        subject: subject.trim().slice(0, 180),
        createdByUid: currentUid,
        createdByName: currentDisplayName,
        createdByEmail: currentEmail,
        createdAt: now,
        updatedAt: now,
        status: 'waiting-admin' as SupportStatus,
        lastMessageAt: now,
        lastMessageFrom: 'user' as SenderRole,
        lastMessageText: firstMessage.trim().slice(0, 300),
        adminSeenAt: '',
        userSeenAt: now,
        messages: [firstSupportMessage],
      });
      setSubject('');
      setFirstMessage('');
      setSelectedThreadId(threadRef.id);
      setSuccess(copy.createSuccess);
    } catch (createError) {
      console.error('Failed creating support thread:', createError);
      setError(mapFirebaseError(createError, copy.createError));
    } finally {
      setIsCreating(false);
    }
  };

  const sendReply = async () => {
    if (!selectedThread) return;
    if (!currentUid) {
      setError(copy.authRequired);
      return;
    }
    const clean = reply.trim();
    if (!clean) return;
    setIsSending(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const senderRole: SenderRole = isAdmin ? 'admin' : 'user';
      const nextMessage: SupportMessageRow = {
        id: `msg_${Date.now()}`,
        threadId: selectedThread.id,
        text: clean.slice(0, 4000),
        senderUid: currentUid,
        senderRole,
        senderName: currentDisplayName || (isAdmin ? 'Admin' : 'User'),
        createdAt: now,
      };
      await updateDoc(getThreadDocRef(selectedThread), {
        messages: [...(selectedThread.messages || []), nextMessage],
        updatedAt: now,
        lastMessageAt: now,
        lastMessageFrom: senderRole,
        lastMessageText: clean.slice(0, 300),
        status: senderRole === 'admin' ? 'waiting-user' : 'waiting-admin',
        ...(senderRole === 'admin' ? { adminSeenAt: now } : { userSeenAt: now }),
      });
      setReply('');
    } catch (sendError) {
      console.error('Failed sending support reply:', sendError);
      setError(mapFirebaseError(sendError, copy.sendError));
    } finally {
      setIsSending(false);
    }
  };

  const updateThreadStatus = async (status: SupportStatus) => {
    if (!selectedThread || !isAdmin) return;
    try {
      await updateDoc(getThreadDocRef(selectedThread), {
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (statusError) {
      console.error('Failed updating support status:', statusError);
    }
  };

  return {
    // derived
    copy,
    isAdmin,
    currentUid,
    // state
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
    // memos
    selectedThread,
    // helpers
    isUnread,
    translateStatus,
    // handlers
    createThread,
    sendReply,
    updateThreadStatus,
  };
}
