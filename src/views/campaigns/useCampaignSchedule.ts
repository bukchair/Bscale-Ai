/**
 * Weekly schedule + time-targeting rules for the campaign builder.
 */
import { useEffect, useState } from 'react';
import type { TimeRule, WeeklySchedule, DayKey, PlatformName, RuleAction } from './types';
import { DAY_KEYS, createEmptyDaySchedule } from './types';

export interface UseCampaignScheduleProps {
  connectedAdPlatforms: string[];
  selectedPlatforms: string[];
  isHebrew: boolean;
  onMessage: (msg: string | null) => void;
}

export const normalizeHour = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(23, Math.round(value)));
};

export const sanitizeHours = (hours: number[]) =>
  [...new Set(hours.map((h) => normalizeHour(h)))].sort((a, b) => a - b);

export function useCampaignSchedule({
  connectedAdPlatforms,
  selectedPlatforms,
  isHebrew,
  onMessage,
}: UseCampaignScheduleProps) {
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({});
  const [selectedSchedulePlatform, setSelectedSchedulePlatform] = useState<string>('Google');
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<DayKey>('mon');

  // Time rules
  const [timeRules, setTimeRules] = useState<TimeRule[]>([]);
  const [rulePlatform, setRulePlatform] = useState<PlatformName>('Google');
  const [ruleStartHour, setRuleStartHour] = useState<number>(18);
  const [ruleEndHour, setRuleEndHour] = useState<number>(22);
  const [ruleAction, setRuleAction] = useState<RuleAction>('boost');
  const [ruleMinRoas, setRuleMinRoas] = useState<number>(3);
  const [ruleReason, setRuleReason] = useState<string>('');

  // ── Effects ───────────────────────────────────────────────────────────────

  // Sync weekly schedule keys with selected platforms
  useEffect(() => {
    setWeeklySchedule((prev) => {
      const next: WeeklySchedule = { ...prev };
      selectedPlatforms.forEach((p) => { if (!next[p]) next[p] = createEmptyDaySchedule(); });
      Object.keys(next).forEach((p) => { if (!selectedPlatforms.includes(p)) delete next[p]; });
      return next;
    });
  }, [selectedPlatforms]);

  // Sync schedule platform selector
  useEffect(() => {
    if (connectedAdPlatforms.length === 0) return;
    setSelectedSchedulePlatform((prev) =>
      connectedAdPlatforms.includes(prev) ? prev : connectedAdPlatforms[0]
    );
  }, [connectedAdPlatforms]);

  // Sync rule platform
  useEffect(() => {
    if (connectedAdPlatforms.length === 0) return;
    setRulePlatform((prev) =>
      connectedAdPlatforms.includes(prev)
        ? (prev as PlatformName)
        : ((connectedAdPlatforms[0] || 'Google') as PlatformName)
    );
  }, [connectedAdPlatforms]);

  // ── Schedule handlers ─────────────────────────────────────────────────────

  const toggleScheduleHour = (platform: string, day: DayKey, hour: number) => {
    setWeeklySchedule((prev) => {
      const next: WeeklySchedule = { ...prev };
      if (!next[platform]) next[platform] = createEmptyDaySchedule();
      const normalizedHour = normalizeHour(hour);
      const currentHours = Array.isArray(next[platform][day]) ? next[platform][day] : [];
      next[platform] = {
        ...next[platform],
        [day]: currentHours.includes(normalizedHour)
          ? currentHours.filter((v) => v !== normalizedHour)
          : sanitizeHours([...currentHours, normalizedHour]),
      };
      return next;
    });
  };

  const isFullDaySelected = (platform: string, day: DayKey) => {
    const hours = weeklySchedule[platform]?.[day] || [];
    return Array.isArray(hours) && hours.length === 24;
  };

  const toggleFullDay = (platform: string, day: DayKey) => {
    setWeeklySchedule((prev) => {
      const next: WeeklySchedule = { ...prev };
      if (!next[platform]) next[platform] = createEmptyDaySchedule();
      const currentHours = Array.isArray(next[platform][day]) ? next[platform][day] : [];
      const fullDay = Array.from({ length: 24 }, (_, h) => h);
      next[platform] = { ...next[platform], [day]: currentHours.length === 24 ? [] : fullDay };
      return next;
    });
  };

  const getActiveSlotsCount = (platform: string): number => {
    const schedule = weeklySchedule[platform];
    if (!schedule) return 0;
    return DAY_KEYS.reduce((sum, day) => sum + (schedule[day]?.length || 0), 0);
  };

  // ── Time rule handlers ────────────────────────────────────────────────────

  const addTimeRule = () => {
    if (!rulePlatform) return;
    const startHour = normalizeHour(ruleStartHour);
    const endHour = normalizeHour(ruleEndHour);
    if (endHour <= startHour) {
      onMessage(isHebrew ? 'שעת סיום חייבת להיות גדולה משעת התחלה.' : 'End hour must be greater than start hour.');
      return;
    }
    const next: TimeRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: rulePlatform,
      startHour,
      endHour,
      action: ruleAction,
      minRoas: ruleMinRoas,
      reason: ruleReason.trim() || undefined,
    };
    setTimeRules((prev) => [next, ...prev]);
    setRuleReason('');
  };

  const removeTimeRule = (id: string) => {
    setTimeRules((prev) => prev.filter((r) => r.id !== id));
  };

  return {
    weeklySchedule, setWeeklySchedule,
    selectedSchedulePlatform, setSelectedSchedulePlatform,
    selectedScheduleDay, setSelectedScheduleDay,
    toggleScheduleHour,
    isFullDaySelected,
    toggleFullDay,
    getActiveSlotsCount,
    timeRules, setTimeRules,
    rulePlatform, setRulePlatform,
    ruleStartHour, setRuleStartHour,
    ruleEndHour, setRuleEndHour,
    ruleAction, setRuleAction,
    ruleMinRoas, setRuleMinRoas,
    ruleReason, setRuleReason,
    addTimeRule,
    removeTimeRule,
  };
}
