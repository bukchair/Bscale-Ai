import React from 'react';
import { CalendarClock, Clock3, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DayKey, PlatformName, RuleAction, TimeRule, WeeklySchedule } from './types';
import { DAY_KEYS } from './types';

export type CampaignSchedulePanelProps = {
  isHebrew: boolean;
  connectedAdPlatforms: string[];
  selectedPlatforms: string[];
  weeklySchedule: WeeklySchedule;
  timeRules: TimeRule[];
  hourOptions: number[];
  dayLabels: Record<string, string>;
  aiRecommendedHoursByPlatform: Record<string, number[]>;
  rulePlatform: string;
  ruleStartHour: number;
  ruleEndHour: number;
  ruleAction: RuleAction;
  ruleMinRoas: number;
  ruleReason: string;
  selectedSchedulePlatform: string;
  selectedScheduleDay: DayKey;
  text: Record<string, string>;
  setRulePlatform: React.Dispatch<React.SetStateAction<PlatformName>>;
  setRuleStartHour: (v: number) => void;
  setRuleEndHour: (v: number) => void;
  setRuleAction: (v: RuleAction) => void;
  setRuleMinRoas: (v: number) => void;
  setRuleReason: (v: string) => void;
  setSelectedSchedulePlatform: (v: string) => void;
  setSelectedScheduleDay: (v: DayKey) => void;
  formatHour: (hour: number) => string;
  formatHourRange: (start: number, end: number) => string;
  getActiveSlotsCount: (platform: string) => number;
  isFullDaySelected: (platform: string, day: DayKey) => boolean;
  addTimeRule: () => void;
  removeTimeRule: (id: string) => void;
  toggleFullDay: (platform: string, day: DayKey) => void;
  toggleScheduleHour: (platform: string, day: DayKey, hour: number) => void;
};

export function CampaignSchedulePanel({
  isHebrew, connectedAdPlatforms, selectedPlatforms, weeklySchedule, timeRules,
  hourOptions, dayLabels, aiRecommendedHoursByPlatform,
  rulePlatform, ruleStartHour, ruleEndHour, ruleAction, ruleMinRoas, ruleReason,
  selectedSchedulePlatform, selectedScheduleDay, text,
  setRulePlatform, setRuleStartHour, setRuleEndHour, setRuleAction, setRuleMinRoas, setRuleReason,
  setSelectedSchedulePlatform, setSelectedScheduleDay,
  formatHour, formatHourRange, getActiveSlotsCount, isFullDaySelected,
  addTimeRule, removeTimeRule, toggleFullDay, toggleScheduleHour,
}: CampaignSchedulePanelProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Time rules */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
        <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-2">
          <Clock3 className="w-4 h-4" />
          {text.timingRulesTitle}
        </h4>
        <p className="text-xs text-amber-700 mb-3">{text.bestWindows}</p>
        <div className="space-y-2 mb-3">
          {connectedAdPlatforms.map((platform) => (
            <div key={platform} className="text-xs bg-white border border-amber-100 rounded-md px-2 py-1.5">
              <span className="font-bold text-amber-900">{platform}: </span>
              {(aiRecommendedHoursByPlatform[platform] || []).length > 0 ? (
                <span className="text-amber-800">
                  {(aiRecommendedHoursByPlatform[platform] || []).map((hour) => formatHour(hour)).join(' · ')}
                </span>
              ) : (
                <span className="text-amber-700">
                  {isHebrew ? 'אין מספיק נתוני שעות להמלצה כרגע.' : 'Not enough hourly data for recommendation yet.'}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
          <select
            value={rulePlatform}
            onChange={(e) => setRulePlatform(e.target.value as PlatformName)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
          >
            {connectedAdPlatforms.map((platform) => (
              <option key={`rule-${platform}`} value={platform}>
                {platform}
              </option>
            ))}
          </select>
          <select
            value={ruleStartHour}
            onChange={(e) => setRuleStartHour(Number(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
          >
            {hourOptions.map((hour) => (
              <option key={`start-${hour}`} value={hour}>
                {isHebrew ? 'מתחיל' : 'Start'} {formatHour(hour)}
              </option>
            ))}
          </select>
          <select
            value={ruleEndHour}
            onChange={(e) => setRuleEndHour(Number(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
          >
            {hourOptions.map((hour) => (
              <option key={`end-${hour}`} value={hour}>
                {isHebrew ? 'מסתיים' : 'End'} {formatHour(hour)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <select
            value={ruleAction}
            onChange={(e) => setRuleAction(e.target.value as RuleAction)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
          >
            <option value="boost">{isHebrew ? 'הגדל תקציב' : 'Boost budget'}</option>
            <option value="limit">{isHebrew ? 'הגבל תקציב' : 'Limit budget'}</option>
            <option value="pause">{isHebrew ? 'השהה מודעה' : 'Pause ads'}</option>
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step={0.1}
              value={ruleMinRoas}
              onChange={(e) => setRuleMinRoas(Number(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
              placeholder="ROAS"
            />
          </div>
          <input
            value={ruleReason}
            onChange={(e) => setRuleReason(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
            placeholder={isHebrew ? 'סיבה/הערה לחוק' : 'Rule reason / note'}
          />
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={addTimeRule}
            className="px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
          >
            {text.addRule}
          </button>
        </div>
        {timeRules.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {timeRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-md bg-white border border-amber-100 px-2 py-1.5 text-xs">
                <span>
                  <strong>{rule.platform}</strong> · {formatHourRange(rule.startHour, rule.endHour)} ·{' '}
                  {rule.action === 'boost'
                    ? isHebrew ? 'הגדל' : 'Boost'
                    : rule.action === 'limit'
                    ? isHebrew ? 'הגבל' : 'Limit'
                    : isHebrew ? 'השהה' : 'Pause'}{' '}
                  · ROAS ≥ {rule.minRoas.toFixed(1)}
                  {rule.reason ? ` · ${rule.reason}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => removeTimeRule(rule.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly schedule */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
        <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-2">
          <CalendarClock className="w-4 h-4" />
          {text.weeklyTitle}
        </h4>
        {selectedPlatforms.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedPlatforms.map((platform) => (
                <button
                  key={`schedule-${platform}`}
                  type="button"
                  onClick={() => setSelectedSchedulePlatform(platform)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-bold border',
                    selectedSchedulePlatform === platform
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-800 border-emerald-200'
                  )}
                >
                  {platform} · {text.weeklyActiveSlots}: {getActiveSlotsCount(platform)}
                </button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {DAY_KEYS.map((day) => (
                <button
                  key={`day-tab-${day}`}
                  type="button"
                  onClick={() => setSelectedScheduleDay(day)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] font-bold border',
                    selectedScheduleDay === day
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-800 border-emerald-200'
                  )}
                >
                  {dayLabels[day]}
                </button>
              ))}
            </div>
            <div className="mb-2">
              <button
                type="button"
                onClick={() => toggleFullDay(selectedSchedulePlatform, selectedScheduleDay)}
                className={cn(
                  'inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold',
                  isFullDaySelected(selectedSchedulePlatform, selectedScheduleDay)
                    ? 'border-emerald-300 text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100'
                    : 'border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50'
                )}
              >
                {isFullDaySelected(selectedSchedulePlatform, selectedScheduleDay)
                  ? text.unmarkFullDay
                  : text.markFullDay}
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-1.5">
              {hourOptions.map((hour) => {
                const active =
                  weeklySchedule[selectedSchedulePlatform]?.[selectedScheduleDay]?.includes(hour) || false;
                return (
                  <button
                    key={`${selectedSchedulePlatform}-${selectedScheduleDay}-${hour}`}
                    type="button"
                    onClick={() => toggleScheduleHour(selectedSchedulePlatform, selectedScheduleDay, hour)}
                    className={cn(
                      'px-2 py-1 rounded-md border text-[10px] font-semibold',
                      active
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    )}
                  >
                    {formatHour(hour)}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-emerald-700">{text.noConnectedPlatforms}</p>
        )}
      </div>
    </div>
  );
}
