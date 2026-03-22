"use client";

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldAlert, CheckCircle2, XCircle, Clock, Zap, Settings, Play, Pause, AlertTriangle, ListTodo, Search, Download, User, Calendar, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useConnections } from '../contexts/ConnectionsContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAutomations } from './automations/useAutomations';
import type { AutoAdsSchedule } from '../lib/firebase';

export function Automations() {
  const { t, dir, language } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { dataOwnerUid, isWorkspaceReadOnly } = useConnections();
  const isHebrew = language === 'he';

  const {
    activeTab, setActiveTab,
    searchTerm, setSearchTerm,
    autoSchedule,
    autoScheduleForm, setAutoScheduleForm,
    autoScheduleSaving,
    lastRunResult,
    pendingApprovals,
    automations,
    handleSaveAutoSchedule,
    handleRunNow,
  } = useAutomations({ dataOwnerUid, isWorkspaceReadOnly, isHebrew, formatCurrency });

  const activities = [
    {
      id: 1,
      user: 'Asher B.',
      action: isHebrew ? 'אישר המלצת AI' : 'Approved AI recommendation',
      details: isHebrew
        ? `הקצאת תקציב מחדש: הועברו ${formatCurrency(500)} ל-Performance Max`
        : `Budget reallocation: moved ${formatCurrency(500)} to Performance Max`,
      time: isHebrew ? 'לפני 10 דקות' : '10 minutes ago',
      type: 'approval',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    },
    {
      id: 2,
      user: 'System AI',
      action: isHebrew ? 'יצר קופירייטינג חדש' : 'Generated new copy',
      details: isHebrew ? 'נוצרו 3 וריאציות לקמפיין "מבצע קיץ"' : 'Created 3 variants for "Summer Sale" campaign',
      time: isHebrew ? 'לפני שעה' : '1 hour ago',
      type: 'ai',
      icon: Zap,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50',
    },
    {
      id: 3,
      user: 'Asher B.',
      action: isHebrew ? 'עדכן הגדרות' : 'Updated settings',
      target: isHebrew ? 'חיוב' : 'Billing',
      details: isHebrew ? 'שונה אמצעי תשלום ראשי' : 'Primary payment method updated',
      time: isHebrew ? 'לפני 3 שעות' : '3 hours ago',
      type: 'settings',
      icon: Settings,
      color: 'text-gray-500',
      bg: 'bg-gray-50',
    },
    {
      id: 4,
      user: 'System',
      action: isHebrew ? 'שגיאת חיבור' : 'Connection error',
      target: 'Shopify',
      details: isHebrew ? 'נכשל סנכרון נתוני מלאי. מנסה שוב...' : 'Inventory data sync failed. Retrying...',
      time: isHebrew ? 'לפני 5 שעות' : '5 hours ago',
      type: 'error',
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50',
    },
    {
      id: 5,
      user: 'Asher B.',
      action: isHebrew ? 'יצר קהל' : 'Created audience',
      target: 'Meta',
      details: isHebrew ? 'Lookalike 1% - לקוחות LTV גבוה' : 'Lookalike 1% - high LTV customers',
      time: isHebrew ? 'לפני יום' : '1 day ago',
      type: 'action',
      icon: User,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      id: 6,
      user: 'System AI',
      action: isHebrew ? 'השהה קמפיין' : 'Paused campaign',
      target: 'Google Ads',
      details: isHebrew
        ? 'כלל אוטומטי: "השהיית ביצועים נמוכים אוטומטית" הופעל עבור "רשת המדיה - ריטרגטינג"'
        : 'Automation rule "Auto pause low performance" was triggered for "Display Network - Retargeting"',
      time: isHebrew ? 'לפני יום' : '1 day ago',
      type: 'automation',
      icon: Zap,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {isWorkspaceReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-bold">
          {isHebrew ? 'מצב צפייה בלבד פעיל. לא ניתן לערוך אוטומציות בחשבון זה.' : 'View-only mode is active. Automations cannot be edited in this account.'}
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.approvalsAutomations') || (isHebrew ? 'אישורים / אוטומציות' : 'Approvals / Automations')}</h1>
          <p className="text-sm text-gray-500 mt-1">{isHebrew ? 'סקור המלצות AI ונהל חוקים אוטומטיים.' : 'Review AI recommendations and manage automation rules.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold shadow-sm">
            <Zap className="w-4 h-4" />
            {isHebrew ? 'צור חוק חדש' : 'Create new rule'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('approvals')}
              className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition-colors", activeTab === 'approvals' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              <ShieldAlert className="w-4 h-4" />
              {isHebrew ? 'אישורים ממתינים' : 'Pending approvals'}
              <span className={cn("bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs", dir === 'rtl' ? "mr-1" : "ml-1")}>3</span>
            </button>
            <button 
              onClick={() => setActiveTab('rules')}
              className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition-colors", activeTab === 'rules' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              <Settings className="w-4 h-4" />
              {isHebrew ? 'חוקים אוטומטיים' : 'Automation rules'}
            </button>
            <button 
              onClick={() => setActiveTab('log')}
              className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition-colors", activeTab === 'log' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              <ListTodo className="w-4 h-4" />
              {isHebrew ? 'יומן פעילות' : 'Activity log'}
            </button>
            <button 
              onClick={() => setActiveTab('auto-ads')}
              className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-md transition-colors", activeTab === 'auto-ads' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              <Calendar className="w-4 h-4" />
              {isHebrew ? 'יצירת מודעות אוטומטית' : 'Auto ad creation'}
            </button>
          </div>
          
          {activeTab === 'log' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400", dir === 'rtl' ? "right-3" : "left-3")} />
                <input 
                  type="text" 
                  placeholder={isHebrew ? 'חיפוש פעילויות...' : 'Search activities...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs",
                    dir === 'rtl' ? "pr-9 pl-3" : "pl-9 pr-3"
                  )}
                />
              </div>
              <button className="p-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                <Download className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              {pendingApprovals.map((approval) => (
                <div key={approval.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded">{approval.type}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {approval.time}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">{approval.description}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-600">{isHebrew ? 'פלטפורמה:' : 'Platform:'} <span className="font-bold text-gray-900" dir="ltr">{approval.platform}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> {isHebrew ? 'השפעה' : 'Impact'}: {approval.impact}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-bold">
                      <XCircle className="w-4 h-4" /> {isHebrew ? 'דחה' : 'Reject'}
                    </button>
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4" /> {isHebrew ? 'אשר' : 'Approve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              {automations.map((rule) => (
                <div key={rule.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">{rule.name}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold",
                        (rule.status === 'פעיל' || rule.status === 'Active') ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      )}>
                        {rule.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded" dir="ltr">{isHebrew ? 'פלטפורמה' : 'Platform'}: {rule.platform}</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {(rule.status === 'פעיל' || rule.status === 'Active') ? (
                      <button className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-white border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors text-sm font-bold">
                        <Pause className="w-4 h-4" /> {isHebrew ? 'השהה' : 'Pause'}
                      </button>
                    ) : (
                      <button className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors text-sm font-bold">
                        <Play className="w-4 h-4" /> {isHebrew ? 'הפעל' : 'Activate'}
                      </button>
                    )}
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-bold">
                      <Settings className="w-4 h-4" /> {isHebrew ? 'ערוך' : 'Edit'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'log' && (
            <div className={cn("relative border-gray-200 space-y-8 py-4", dir === 'rtl' ? "border-r mr-3" : "border-l ml-3")}>
              {activities.filter(a => a.action.toLowerCase().includes(searchTerm.toLowerCase()) || a.details.toLowerCase().includes(searchTerm.toLowerCase())).map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className={cn("relative", dir === 'rtl' ? "pr-8" : "pl-8")}>
                    <div className={cn("absolute top-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white", activity.bg, dir === 'rtl' ? "-right-4" : "-left-4")}>
                      <Icon className={cn("w-4 h-4", activity.color)} />
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">{activity.user}</span>
                          <span className="text-gray-500 text-sm">{activity.action}</span>
                          {activity.target && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">{activity.target}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {activity.time}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{activity.details}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'auto-ads' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h3 className="text-sm font-bold text-indigo-900 mb-1">{isHebrew ? 'יצירת מודעות אוטומטית' : 'Auto ad creation'}</h3>
                <p className="text-xs text-indigo-700">
                  {isHebrew
                    ? 'בהתבסס על מוצרים מ-WooCommerce, המערכת תיצור קופירייטינג למודעות בתדירות שבחרת ותשמור אותן כטיוטות במעבדת היצירה.'
                    : 'Based on WooCommerce products, the system will generate ad copy at your chosen frequency and save drafts in Creative Lab.'}
                </p>
              </div>
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScheduleForm.enabled}
                    onChange={(e) => setAutoScheduleForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium text-gray-900">{isHebrew ? 'הפעל יצירת מודעות אוטומטית' : 'Enable automatic ad creation'}</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'תדירות' : 'Frequency'}</label>
                  <select
                    value={autoScheduleForm.frequency}
                    onChange={(e) => setAutoScheduleForm((f) => ({ ...f, frequency: e.target.value as AutoAdsSchedule['frequency'] }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="daily">{isHebrew ? 'יומי' : 'Daily'}</option>
                    <option value="every_3_days">{isHebrew ? 'כל 3 ימים' : 'Every 3 days'}</option>
                    <option value="weekly">{isHebrew ? 'שבועי' : 'Weekly'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'פלטפורמות לפרסום (להצגה)' : 'Ad platforms (for preview)'}</label>
                  <div className="flex flex-wrap gap-3">
                    {(['google', 'meta', 'tiktok'] as const).map((p) => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoScheduleForm.platforms.includes(p)}
                          onChange={(e) => {
                            setAutoScheduleForm((f) => ({
                              ...f,
                              platforms: e.target.checked ? [...f.platforms, p] : f.platforms.filter((x) => x !== p),
                            }));
                          }}
                          className="rounded border-gray-300"
                        />
                        <span>{p === 'google' ? 'Google' : p === 'meta' ? 'Meta' : 'TikTok'}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isHebrew ? 'מספר מוצרים מקסימלי ליצירה בכל הרצה' : 'Maximum products per run'}</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={autoScheduleForm.productLimit}
                    onChange={(e) => setAutoScheduleForm((f) => ({ ...f, productLimit: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={handleSaveAutoSchedule}
                    disabled={autoScheduleSaving || isWorkspaceReadOnly}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm"
                  >
                    {autoScheduleSaving ? (isHebrew ? 'שומר...' : 'Saving...') : (isHebrew ? 'שמור הגדרות' : 'Save settings')}
                  </button>
                  <button
                    onClick={handleRunNow}
                    disabled={isWorkspaceReadOnly}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" /> {isHebrew ? 'הרץ עכשיו' : 'Run now'}
                  </button>
                </div>
              </div>
              {autoSchedule?.lastRunAt && (
                <p className="text-xs text-gray-500">
                  {isHebrew ? 'הרצה אחרונה:' : 'Last run:'}{' '}
                  {new Date(autoSchedule.lastRunAt).toLocaleString(isHebrew ? 'he-IL' : 'en-US')}
                </p>
              )}
              {autoSchedule?.nextRunAt && autoScheduleForm.enabled && (
                <p className="text-xs text-gray-500">
                  {isHebrew ? 'הרצה הבאה:' : 'Next run:'}{' '}
                  {new Date(autoSchedule.nextRunAt).toLocaleString(isHebrew ? 'he-IL' : 'en-US')}
                </p>
              )}
              {lastRunResult && (
                <p className="text-sm text-emerald-600">
                  {lastRunResult.ran
                    ? (isHebrew
                        ? `נוצרו ${lastRunResult.created ?? 0} מודעות אוטומטית.`
                        : `Created ${lastRunResult.created ?? 0} ads automatically.`)
                    : (isHebrew
                        ? 'לא בוצעה הרצה (תזמון או חיבור WooCommerce).'
                        : 'No run was executed (schedule or WooCommerce connection missing).')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
