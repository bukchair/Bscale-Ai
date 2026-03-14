import React, { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { MessageSquare, Send, LifeBuoy, CheckCircle2, Clock3, AlertCircle } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useLanguage, type Language } from '../contexts/LanguageContext';

type SupportStatus = 'open' | 'waiting-admin' | 'waiting-user' | 'resolved';
type SenderRole = 'user' | 'admin';

type SupportThreadRow = {
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

type SupportMessageRow = {
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

const COPY: Record<Language, SupportCopy> = {
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
    allRequests: 'כל פניות התמיכה',
    noRequests: 'אין עדיין פניות להצגה.',
    chatPlaceholder: 'כתבו תגובה...',
    send: 'שלח',
    selectRequest: 'בחרו פנייה משמאל כדי לראות את השיחה.',
    resolve: 'סמן כטופל',
    reopen: 'פתח מחדש',
    statusOpen: 'פתוח',
    statusWaitingAdmin: 'ממתין לתמיכה',
    statusWaitingUser: 'ממתין למשתמש',
    statusResolved: 'טופל',
    createdBy: 'נוצר על ידי',
    validationSubject: 'יש להזין נושא לפנייה.',
    validationMessage: 'יש להזין הודעה.',
    createError: 'שמירת הפנייה נכשלה. נסה שוב.',
    sendError: 'שליחת ההודעה נכשלה. נסה שוב.',
    authRequired: 'נדרשת התחברות כדי לשלוח פנייה.',
    createSuccess: 'הפנייה נשלחה בהצלחה.',
  },
  en: {
    title: 'Technical Support',
    subtitleUser: 'Write to support here and get real help from our team.',
    subtitleAdmin: 'Central support inbox: receive user requests and reply technically.',
    newRequest: 'New request',
    subject: 'Request subject',
    firstMessage: 'What issue or request do you have?',
    sendRequest: 'Send request',
    sending: 'Sending...',
    myRequests: 'My requests',
    allRequests: 'All support requests',
    noRequests: 'No support requests yet.',
    chatPlaceholder: 'Write a reply...',
    send: 'Send',
    selectRequest: 'Select a request on the left to view the conversation.',
    resolve: 'Mark resolved',
    reopen: 'Reopen',
    statusOpen: 'Open',
    statusWaitingAdmin: 'Waiting for support',
    statusWaitingUser: 'Waiting for user',
    statusResolved: 'Resolved',
    createdBy: 'Created by',
    validationSubject: 'Subject is required.',
    validationMessage: 'Message is required.',
    createError: 'Failed to create request. Please try again.',
    sendError: 'Failed to send message. Please try again.',
    authRequired: 'You must be logged in to send a request.',
    createSuccess: 'Support request sent successfully.',
  },
  ru: {
    title: 'Техническая поддержка',
    subtitleUser: 'Пишите сюда, и команда поддержки ответит вам в системе.',
    subtitleAdmin: 'Центральный inbox поддержки для ответов пользователям.',
    newRequest: 'Новый запрос',
    subject: 'Тема запроса',
    firstMessage: 'Опишите проблему или запрос',
    sendRequest: 'Отправить запрос',
    sending: 'Отправка...',
    myRequests: 'Мои запросы',
    allRequests: 'Все запросы',
    noRequests: 'Пока нет запросов.',
    chatPlaceholder: 'Напишите ответ...',
    send: 'Отправить',
    selectRequest: 'Выберите запрос слева, чтобы открыть диалог.',
    resolve: 'Отметить решенным',
    reopen: 'Открыть снова',
    statusOpen: 'Открыт',
    statusWaitingAdmin: 'Ожидает поддержки',
    statusWaitingUser: 'Ожидает пользователя',
    statusResolved: 'Решено',
    createdBy: 'Создал',
    validationSubject: 'Укажите тему запроса.',
    validationMessage: 'Введите сообщение.',
    createError: 'Не удалось создать запрос. Попробуйте снова.',
    sendError: 'Не удалось отправить сообщение. Попробуйте снова.',
    authRequired: 'Нужно войти в систему, чтобы отправить запрос.',
    createSuccess: 'Запрос в поддержку успешно отправлен.',
  },
  pt: {
    title: 'Suporte tecnico',
    subtitleUser: 'Escreva aqui e receba suporte real da equipe.',
    subtitleAdmin: 'Inbox central de suporte para atender os usuarios.',
    newRequest: 'Nova solicitacao',
    subject: 'Assunto',
    firstMessage: 'Qual problema ou pedido voce tem?',
    sendRequest: 'Enviar solicitacao',
    sending: 'Enviando...',
    myRequests: 'Minhas solicitacoes',
    allRequests: 'Todas as solicitacoes',
    noRequests: 'Ainda nao ha solicitacoes.',
    chatPlaceholder: 'Escreva uma resposta...',
    send: 'Enviar',
    selectRequest: 'Selecione uma solicitacao a esquerda para ver a conversa.',
    resolve: 'Marcar resolvido',
    reopen: 'Reabrir',
    statusOpen: 'Aberto',
    statusWaitingAdmin: 'Aguardando suporte',
    statusWaitingUser: 'Aguardando usuario',
    statusResolved: 'Resolvido',
    createdBy: 'Criado por',
    validationSubject: 'Assunto obrigatorio.',
    validationMessage: 'Mensagem obrigatoria.',
    createError: 'Falha ao criar solicitacao. Tente novamente.',
    sendError: 'Falha ao enviar mensagem. Tente novamente.',
    authRequired: 'Voce precisa entrar para enviar a solicitacao.',
    createSuccess: 'Solicitacao enviada com sucesso.',
  },
  fr: {
    title: 'Support technique',
    subtitleUser: 'Ecrivez ici pour obtenir une assistance reelle de notre equipe.',
    subtitleAdmin: 'Boite centrale de support pour repondre aux utilisateurs.',
    newRequest: 'Nouvelle demande',
    subject: 'Sujet de la demande',
    firstMessage: 'Quel est le probleme ou la demande ?',
    sendRequest: 'Envoyer la demande',
    sending: 'Envoi...',
    myRequests: 'Mes demandes',
    allRequests: 'Toutes les demandes',
    noRequests: 'Aucune demande pour le moment.',
    chatPlaceholder: 'Ecrire une reponse...',
    send: 'Envoyer',
    selectRequest: 'Selectionnez une demande a gauche pour voir la conversation.',
    resolve: 'Marquer resolu',
    reopen: 'Rouvrir',
    statusOpen: 'Ouvert',
    statusWaitingAdmin: 'En attente du support',
    statusWaitingUser: 'En attente utilisateur',
    statusResolved: 'Resolu',
    createdBy: 'Cree par',
    validationSubject: 'Le sujet est obligatoire.',
    validationMessage: 'Le message est obligatoire.',
    createError: 'Impossible de creer la demande. Reessayez.',
    sendError: 'Impossible d envoyer le message. Reessayez.',
    authRequired: 'Vous devez vous connecter pour envoyer une demande.',
    createSuccess: 'Demande de support envoyee avec succes.',
  },
};

const statusClassName: Record<SupportStatus, string> = {
  open: 'bg-indigo-50 text-indigo-700',
  'waiting-admin': 'bg-amber-50 text-amber-700',
  'waiting-user': 'bg-blue-50 text-blue-700',
  resolved: 'bg-emerald-50 text-emerald-700',
};

export function Support({
  userProfile,
}: {
  userProfile?: { role?: string; uid?: string; name?: string; email?: string } | null;
}) {
  const { language, dir } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const isAdmin = userProfile?.role === 'admin';
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || userProfile?.uid || '';
  const currentDisplayName = currentUser?.displayName || userProfile?.name || 'User';
  const currentEmail = currentUser?.email || userProfile?.email || '';
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
  const mapFirebaseError = (raw: unknown, fallback: string) => {
    const message = raw instanceof Error ? raw.message : '';
    if (/permission|denied|missing or insufficient/i.test(message)) {
      return language === 'he' ? 'אין הרשאת כתיבה לתמיכה בחשבון הנוכחי.' : `${fallback} (permission denied)`;
    }
    return fallback;
  };

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
                  ...(row.data() as any),
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
                ...(row.data() as any),
              }))
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
  }, [currentUid, isAdmin]);

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

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [selectedThreadId, threads]
  );

  const getThreadDocRef = (thread: SupportThreadRow) => {
    return doc(db, 'users', thread.ownerUid || thread.createdByUid, 'settings', thread.docId || thread.id);
  };

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
  }, [isAdmin, selectedThread]);

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

  return (
    <div className="max-w-7xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-indigo-600" />
          {copy.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{isAdmin ? copy.subtitleAdmin : copy.subtitleUser}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1 space-y-4">
          {!isAdmin && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-900">{copy.newRequest}</p>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={copy.subject}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
              <textarea
                value={firstMessage}
                onChange={(event) => setFirstMessage(event.target.value)}
                placeholder={copy.firstMessage}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm min-h-[90px]"
              />
              <button
                onClick={createThread}
                disabled={isCreating || !currentUid}
                className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
              >
                {isCreating ? copy.sending : copy.sendRequest}
              </button>
              {error && (
                <p className="text-xs text-red-600 inline-flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </p>
              )}
              {success && (
                <p className="text-xs text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {success}
                </p>
              )}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">{isAdmin ? copy.allRequests : copy.myRequests}</p>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {threads.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">{copy.noRequests}</div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      'w-full p-4 text-start hover:bg-gray-50 transition-colors',
                      selectedThreadId === thread.id && 'bg-indigo-50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900 truncate">{thread.subject}</p>
                      {isUnread(thread) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold', statusClassName[thread.status])}>
                        {translateStatus(thread.status)}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString(dir === 'rtl' ? 'he-IL' : 'en-US') : '--'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{thread.lastMessageText || '—'}</p>
                    {isAdmin && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {copy.createdBy}: {thread.createdByName || 'User'}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-[620px]">
          {selectedThread ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">{selectedThread.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedThread.lastMessageAt
                      ? new Date(selectedThread.lastMessageAt).toLocaleString(dir === 'rtl' ? 'he-IL' : 'en-US')
                      : '--'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-1 rounded-md text-[10px] font-bold', statusClassName[selectedThread.status])}>
                    {translateStatus(selectedThread.status)}
                  </span>
                  {isAdmin && selectedThread.status !== 'resolved' && (
                    <button
                      onClick={() => updateThreadStatus('resolved')}
                      className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {copy.resolve}
                    </button>
                  )}
                  {isAdmin && selectedThread.status === 'resolved' && (
                    <button
                      onClick={() => updateThreadStatus('open')}
                      className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold hover:bg-indigo-100 inline-flex items-center gap-1"
                    >
                      <Clock3 className="w-3.5 h-3.5" />
                      {copy.reopen}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {messages.map((message) => {
                  const mine = message.senderUid === currentUid;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-line',
                        mine
                          ? 'ms-auto bg-indigo-600 text-white'
                          : message.senderRole === 'admin'
                          ? 'bg-white border border-indigo-100 text-gray-800'
                          : 'bg-white border border-gray-200 text-gray-800'
                      )}
                    >
                      <p className="text-[10px] opacity-70 mb-1">{message.senderName || (message.senderRole === 'admin' ? 'Admin' : 'User')}</p>
                      <p>{message.text}</p>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') sendReply();
                    }}
                    placeholder={copy.chatPlaceholder}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  />
                  <button
                    onClick={sendReply}
                    disabled={isSending}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSending ? copy.sending : copy.send}
                  </button>
                </div>
                {error && (
                  <p className="mt-2 text-xs text-red-600 inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {error}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="h-full min-h-[520px] flex items-center justify-center text-sm text-gray-500 px-4 text-center">
              <div>
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                {copy.selectRequest}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
