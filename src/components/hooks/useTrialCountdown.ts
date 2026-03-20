import { useEffect, useMemo, useState } from 'react';

type UserProfile = {
  subscriptionStatus?: string;
  role?: string;
  trialEndsAt?: string;
  trialStartedAt?: string;
  createdAt?: string;
};

export function useTrialCountdown(userProfile: UserProfile | undefined, dir: string) {
  const isTrialUser =
    userProfile?.subscriptionStatus === 'trial' && userProfile?.role !== 'admin';

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isTrialUser) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [isTrialUser]);

  const trialEndsAtMs = useMemo(() => {
    if (!isTrialUser) return 0;
    const endsMs = Date.parse(String(userProfile?.trialEndsAt || ''));
    if (Number.isFinite(endsMs)) return endsMs;
    const startedMs = Date.parse(
      String(userProfile?.trialStartedAt || userProfile?.createdAt || '')
    );
    if (!Number.isFinite(startedMs)) return 0;
    return startedMs + 3 * 24 * 60 * 60 * 1000;
  }, [isTrialUser, userProfile?.createdAt, userProfile?.trialEndsAt, userProfile?.trialStartedAt]);

  const remainingMs = useMemo(
    () => (trialEndsAtMs ? Math.max(0, trialEndsAtMs - nowMs) : 0),
    [trialEndsAtMs, nowMs]
  );

  const trialCountdownLabel = useMemo(() => {
    if (!isTrialUser) return '';
    if (remainingMs <= 0) return dir === 'rtl' ? 'הסתיים' : 'Expired';
    const totalMinutes = Math.floor(remainingMs / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return dir === 'rtl' ? `${days} ימים ${hours} שעות` : `${days}d ${hours}h`;
    if (hours > 0) return dir === 'rtl' ? `${hours} שעות ${minutes} דק׳` : `${hours}h ${minutes}m`;
    return dir === 'rtl' ? `${minutes} דק׳` : `${minutes}m`;
  }, [dir, isTrialUser, remainingMs]);

  return { isTrialUser, trialCountdownLabel };
}
