import { useEffect, useMemo, useState } from 'react';
import { auth, getAutoAdsSchedule, setAutoAdsSchedule, type AutoAdsSchedule } from '../../lib/firebase';
import { runAutoAdsIfNeeded } from '../../lib/autoAdsRunner';

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseAutomationsProps {
  dataOwnerUid: string | null | undefined;
  isWorkspaceReadOnly: boolean;
  isHebrew: boolean;
  formatCurrency: (value: number) => string;
}

export function useAutomations({ dataOwnerUid, isWorkspaceReadOnly, isHebrew, formatCurrency }: UseAutomationsProps) {
  const uid = dataOwnerUid || auth.currentUser?.uid;

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'approvals' | 'rules' | 'log' | 'auto-ads'>('approvals');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoSchedule, setAutoSchedule] = useState<AutoAdsSchedule | null>(null);
  const [autoScheduleForm, setAutoScheduleForm] = useState({
    enabled: false,
    frequency: 'daily' as AutoAdsSchedule['frequency'],
    platforms: [] as ('google' | 'meta' | 'tiktok')[],
    productLimit: 3,
  });
  const [autoScheduleSaving, setAutoScheduleSaving] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<{ ran: boolean; created?: number } | null>(null);

  // ── Memos: static demo data ────────────────────────────────────────────────
  const pendingApprovals = useMemo(() => [
    {
      id: 1,
      type: isHebrew ? 'הקצאת תקציב מחדש' : 'Budget reallocation',
      description: isHebrew
        ? `העבר ${formatCurrency(500)} מ-"חיפוש מותג" ל-"Performance Max" עקב ROAS גבוה יותר.`
        : `Move ${formatCurrency(500)} from "Brand Search" to "Performance Max" due to higher ROAS.`,
      platform: 'Google Ads',
      impact: isHebrew ? 'גבוה' : 'High',
      time: isHebrew ? 'לפני שעתיים' : '2 hours ago',
    },
    {
      id: 2,
      type: isHebrew ? 'עדכון קופירייטינג' : 'Copy update',
      description: isHebrew
        ? 'עדכן את טקסט המודעה ב-Meta כך שיכלול "משלוח חינם" על סמך ניתוח מתחרים.'
        : 'Update Meta ad copy to include "Free shipping" based on competitor analysis.',
      platform: 'Meta',
      impact: isHebrew ? 'בינוני' : 'Medium',
      time: isHebrew ? 'לפני 5 שעות' : '5 hours ago',
    },
    {
      id: 3,
      type: isHebrew ? 'החרגת מילות מפתח' : 'Negative keyword update',
      description: isHebrew
        ? 'הוסף "חינם" ו-"זול" כמילות מפתח שליליות כדי להפחית הוצאות מבוזבזות.'
        : 'Add "free" and "cheap" as negative keywords to reduce wasted spend.',
      platform: 'Google Ads',
      impact: isHebrew ? 'גבוה' : 'High',
      time: isHebrew ? 'לפני יום' : '1 day ago',
    },
  ], [isHebrew, formatCurrency]);

  const automations = useMemo(() => [
    {
      id: 1,
      name: isHebrew ? 'השהיה אוטומטית של ביצועים נמוכים' : 'Auto pause low performance',
      description: isHebrew
        ? `השהה מודעות עם ROAS < 1.0 לאחר 3 ימים והוצאה של ${formatCurrency(100)}.`
        : `Pause ads with ROAS < 1.0 after 3 days and spend of ${formatCurrency(100)}.`,
      status: isHebrew ? 'פעיל' : 'Active',
      platform: isHebrew ? 'כל הפלטפורמות' : 'All platforms',
    },
    {
      id: 2,
      name: isHebrew ? 'הגדלת תקציב' : 'Budget increase',
      description: isHebrew
        ? 'הגדל תקציב ב-10% עבור קמפיינים ששומרים על ROAS > 3.0 במשך 7 ימים.'
        : 'Increase budget by 10% for campaigns with ROAS > 3.0 over 7 days.',
      status: isHebrew ? 'מושהה' : 'Paused',
      platform: 'Meta',
    },
    {
      id: 3,
      name: isHebrew ? 'התאמות הצעות מחיר' : 'Bid adjustments',
      description: isHebrew
        ? 'הגדל הצעות מחיר ב-15% בשעות שיא של המרות (18:00 - 22:00).'
        : 'Increase bids by 15% during conversion peak hours (18:00 - 22:00).',
      status: isHebrew ? 'פעיל' : 'Active',
      platform: 'Google Ads',
    },
  ], [isHebrew, formatCurrency]);

  // ── Effect: load schedule ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    getAutoAdsSchedule(uid).then((s) => {
      if (s) {
        setAutoSchedule(s);
        setAutoScheduleForm({
          enabled: s.enabled,
          frequency: s.frequency,
          platforms: s.platforms || [],
          productLimit: s.productLimit ?? 3,
        });
      }
    });
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveAutoSchedule = async () => {
    if (isWorkspaceReadOnly) return;
    if (!uid) return;
    setAutoScheduleSaving(true);
    const now = new Date().toISOString();
    const nextRun = new Date();
    if (autoScheduleForm.frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
    else if (autoScheduleForm.frequency === 'every_3_days') nextRun.setDate(nextRun.getDate() + 3);
    else nextRun.setDate(nextRun.getDate() + 7);
    const isFirstEnable = autoScheduleForm.enabled && !autoSchedule?.nextRunAt;
    try {
      await setAutoAdsSchedule(uid, {
        enabled: autoScheduleForm.enabled,
        frequency: autoScheduleForm.frequency,
        platforms: autoScheduleForm.platforms,
        productLimit: autoScheduleForm.productLimit,
        lastRunAt: autoSchedule?.lastRunAt ?? null,
        nextRunAt: autoScheduleForm.enabled ? (isFirstEnable ? now : nextRun.toISOString()) : null,
      });
      setAutoSchedule(await getAutoAdsSchedule(uid));
    } finally {
      setAutoScheduleSaving(false);
    }
  };

  const handleRunNow = async () => {
    if (isWorkspaceReadOnly) return;
    if (!uid) return;
    const result = await runAutoAdsIfNeeded(uid);
    setLastRunResult(result);
    setAutoSchedule(await getAutoAdsSchedule(uid));
  };

  return {
    // state
    activeTab, setActiveTab,
    searchTerm, setSearchTerm,
    autoSchedule,
    autoScheduleForm, setAutoScheduleForm,
    autoScheduleSaving,
    lastRunResult,
    // memos
    pendingApprovals,
    automations,
    // handlers
    handleSaveAutoSchedule,
    handleRunNow,
  };
}
