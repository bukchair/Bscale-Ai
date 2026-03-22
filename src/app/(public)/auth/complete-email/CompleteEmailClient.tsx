'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Lock, Loader2 } from 'lucide-react';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { SiteLegalNotice } from '@/src/components/SiteLegalNotice';
import { trackEvent } from '@/src/lib/tracking';

export default function CompleteEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { t, dir, language } = useLanguage();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isHebrew = language === 'he';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError(t('auth.completeInvalidLink'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.completePasswordShort'));
      return;
    }
    if (password !== password2) {
      setError(t('auth.completePasswordMismatch'));
      return;
    }
    setLoading(true);
    trackEvent('bscale_email_signup_complete_start', {});
    try {
      const res = await fetch('/api/auth/email-signup/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        email?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isHebrew ? 'ההרשמה נכשלה.' : 'Registration failed.'));
      }
      const emailToUse = data.email || '';
      if (!emailToUse) {
        throw new Error(isHebrew ? 'חסר אימייל בתשובה השרת.' : 'Missing email in server response.');
      }
      // Sign in to get the session cookie
      const loginRes = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: emailToUse, password }),
      });
      if (!loginRes.ok) {
        const b = (await loginRes.json().catch(() => null)) as { message?: string } | null;
        throw new Error(b?.message || (isHebrew ? 'התחברות נכשלה.' : 'Sign-in failed.'));
      }
      trackEvent('bscale_email_signup_complete_ok', {});
      router.push('/app');
    } catch (err: unknown) {
      trackEvent('bscale_email_signup_complete_err', {
        error_message: err instanceof Error ? err.message : 'unknown',
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token.trim()) {
    return (
      <div className="min-h-screen flex flex-col justify-center py-12 px-4" dir={dir}>
        <div className="max-w-md mx-auto text-center text-red-600 dark:text-red-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-2" />
          <p>{t('auth.completeInvalidLink')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-[#050505] flex flex-col justify-center py-12 sm:px-6 lg:px-8"
      dir={dir}
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
          {t('auth.completeTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">{t('auth.completeSubtitle')}</p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-white/10 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-200 dark:border-white/10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 rounded-xl flex gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('auth.password')}
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute start-3 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full ps-10 pe-3 py-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('auth.confirmPassword')}
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute start-3 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="block w-full ps-10 pe-3 py-3 border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white sm:text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {t('auth.completeCta')}
            </button>
          </form>
        </div>
        <SiteLegalNotice centered compact className="mt-4 text-gray-500 dark:text-gray-400" />
      </div>
    </div>
  );
}
