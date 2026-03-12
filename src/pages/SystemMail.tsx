import React, { useState } from 'react';
import { Mail, Inbox, Send, Archive, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

type MailStatus = 'new' | 'read' | 'archived';

interface MailThread {
  id: string;
  subject: string;
  from: string;
  to: string;
  preview: string;
  updatedAt: string;
  status: MailStatus;
  tag?: 'alert' | 'question' | 'system';
}

interface MailMessage {
  id: string;
  from: 'user' | 'system';
  author: string;
  createdAt: string;
  body: string;
}

const mockThreads: MailThread[] = [
  {
    id: 't1',
    subject: 'התראות מערכת יומיות - BScale AI',
    from: 'alerts@bscale.co.il',
    to: 'admin@agency.co.il',
    preview: 'סיכום יומי: 3 קמפיינים ב‑ROAS נמוך מהיעד...',
    updatedAt: 'היום • 09:12',
    status: 'new',
    tag: 'alert',
  },
  {
    id: 't2',
    subject: 'שאלה של משתמש: איך מחברים WooCommerce?',
    from: 'user@example.com',
    to: 'support@bscale.co.il',
    preview: 'שלום, ניסיתי לחבר את החנות אבל אני לא בטוח באיזה URL להשתמש...',
    updatedAt: 'אתמול • 22:03',
    status: 'read',
    tag: 'question',
  },
  {
    id: 't3',
    subject: 'דוח שבועי אוטומטי',
    from: 'alerts@bscale.co.il',
    to: 'ceo@company.com',
    preview: 'שבוע מצוין! ROAS ממוצע 3.1x, 12% עליה בהכנסות...',
    updatedAt: '11.03 • 08:00',
    status: 'archived',
    tag: 'system',
  },
];

const mockMessages: MailMessage[] = [
  {
    id: 'm1',
    from: 'system',
    author: 'BScale AI',
    createdAt: '09:12',
    body:
      'שלום, זהו סיכום יומי אוטומטי של ביצועי הקמפיינים שלך במערכת BScale AI.\n\n' +
      '- 3 קמפיינים עם ROAS נמוך מהיעד\n' +
      '- 1 קמפיין עם תקציב לא מנוצל\n\n' +
      'מומלץ להיכנס לדשבורד ולהחיל את המלצות ה‑AI הרלוונטיות.',
  },
  {
    id: 'm2',
    from: 'user',
    author: 'מנהל השיווק',
    createdAt: '09:20',
    body: 'תודה על הסיכום. נשמח לקבל מחר גם התראות על סטטוס מלאי מהמוצרים.',
  },
];

export function SystemMail() {
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'archived'>('inbox');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>('t1');
  const [isSending, setIsSending] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  const threads = mockThreads.filter((t) => {
    if (activeFolder === 'inbox') return t.status === 'new' || t.status === 'read';
    if (activeFolder === 'archived') return t.status === 'archived';
    return true; // sent - בדמו מציג את הכל
  });

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || threads[0] || null;

  const handleSendReply = () => {
    if (!replyBody.trim()) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setReplyBody('');
      alert('בדמו - התשובה נשלחה דרך תיבת המערכת הקבועה.\nבחיבור מלא זה ישלח דרך Gmail API לחשבון שהגדרת.');
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">דואר מערכת</h1>
            <p className="text-sm text-gray-500 mt-1">
              ניהול הודעות והתראות שנשלחות מחשבון הדוא״ל הקבוע של המערכת.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[640px]">
        {/* Sidebar folders */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              תיבות
            </p>
            <div className="space-y-2">
              <button
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
                  activeFolder === 'inbox'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => setActiveFolder('inbox')}
              >
                <Inbox className="w-4 h-4" />
                דואר נכנס
              </button>
              <button
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
                  activeFolder === 'sent'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => setActiveFolder('sent')}
              >
                <Send className="w-4 h-4" />
                נשלח
              </button>
              <button
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
                  activeFolder === 'archived'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
                onClick={() => setActiveFolder('archived')}
              >
                <Archive className="w-4 h-4" />
                ארכיון
              </button>
            </div>
          </div>
          <div className="p-4 text-xs text-gray-500 border-t border-gray-100 mt-auto bg-gray-50">
            מחובר לחשבון הדוא״ל הקבוע של המערכת (דמו). בחיבור מלא התוכן יסתנכרן עם Gmail.
          </div>
        </div>

        {/* Thread list */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">שיחות</p>
            <span className="text-xs text-gray-400">{threads.length} שיחות</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm p-6">
                <Inbox className="w-10 h-10 mb-3" />
                אין שיחות בתיבה זו.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {threads.map((thread) => (
                  <li
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      'px-4 py-3 cursor-pointer hover:bg-indigo-50/60 transition-colors flex items-start gap-3',
                      selectedThreadId === thread.id && 'bg-indigo-50'
                    )}
                  >
                    <div className="mt-1">
                      {thread.tag === 'alert' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
                          התראה
                        </span>
                      )}
                      {thread.tag === 'question' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                          שאלה
                        </span>
                      )}
                      {thread.tag === 'system' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                          מערכת
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{thread.subject}</p>
                        <span className="text-[11px] text-gray-400 shrink-0">{thread.updatedAt}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{thread.preview}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        מ־{thread.from} אל {thread.to}
                      </p>
                    </div>
                    {thread.status === 'new' && (
                      <span className="w-2 h-2 rounded-full bg-emerלד-500 mt-2" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Conversation view */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          {selectedThread ? (
            <>
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                    {selectedThread.subject}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    מ־{selectedThread.from} אל {selectedThread.to} • {selectedThread.updatedAt}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    onClick={() =>
                      alert(
                        'בדמו - סימון כשיחה טופלה בלבד. בחיבור מלא זה יעדכן שדה status ויזיז לארכיון.'
                      )
                    }
                >
                  סמן כטופל
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {mockMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'max-w-lg rounded-2xl px-4 py-3 text-sm shadow-sm',
                      msg.from === 'system'
                        ? 'bg-indigo-600 text-white ml-auto'
                        : 'bg-white text-gray-800'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold opacity-80">{msg.author}</span>
                      <span className="text-[10px] opacity-70">{msg.createdAt}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 p-4 bg-white space-y-3">
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  placeholder="כתוב תשובה שתישלח ממייל המערכת הקבוע..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    התשובה תישלח מחשבון הדוא״ל הקבוע שהגדרת במערכת (Gmail OAuth).
                  </p>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={isSending || !replyBody.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    שלח תשובה
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
              <AlertCircle className="w-10 h-10 mb-3" />
              בחר שיחה מהרשימה כדי לראות את התוכן.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

