"use client";

import React from 'react';
import { MessageSquare, Send, LifeBuoy, CheckCircle2, Clock3, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useSupport, type SupportStatus, type SupportThreadRow } from './support/useSupport';

const statusClassName: Record<SupportStatus, string> = {
  open: 'bg-indigo-50 text-indigo-700',
  'waiting-admin': 'bg-amber-50 text-amber-700',
  'waiting-user': 'bg-blue-50 text-blue-700',
  resolved: 'bg-emerald-50 text-emerald-700',
};

export function Support({
  userProfile,
}: {
  userProfile?: { role?: string; uid?: string; name?: string; email?: string | null } | null;
}) {
  const { language, dir } = useLanguage();
  const {
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
  } = useSupport({ userProfile, language });

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
