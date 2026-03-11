import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Save, Bell, Lock, Globe, User, Building, CreditCard, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

export function Settings() {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'agency' | 'billing' | 'notifications' | 'security'>('profile');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'profile' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <User className={cn("w-5 h-5", activeTab === 'profile' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.personalProfile')}
          </button>
          <button
            onClick={() => setActiveTab('agency')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'agency' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Building className={cn("w-5 h-5", activeTab === 'agency' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.agencyDetails')}
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'billing' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <CreditCard className={cn("w-5 h-5", activeTab === 'billing' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.billingPlans')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'notifications' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Bell className={cn("w-5 h-5", activeTab === 'notifications' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.notifications')}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'security' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Shield className={cn("w-5 h-5", activeTab === 'security' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.securityPrivacy')}
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{t('settings.personalProfile')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.updateProfileDesc')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold">
                    אב
                  </div>
                  <div>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      {t('settings.changePhoto')}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">{t('settings.photoRequirements')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.firstName')}</label>
                    <input type="text" defaultValue="אשר" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.lastName')}</label>
                    <input type="text" defaultValue="בוקשפן" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.emailAddress')}</label>
                    <input type="email" defaultValue="asher205@gmail.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                  <Save className="w-4 h-4" />
                  {t('settings.saveChanges')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'agency' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{t('settings.agencyDetails')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.agencyDetailsDesc')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.agencyName')}</label>
                  <input type="text" defaultValue="בוקשפן דיגיטל" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.website')}</label>
                  <input type="url" defaultValue="https://example.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.shortDescription')}</label>
                  <textarea rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" defaultValue="סוכנות שיווק דיגיטלי המתמחה ב-E-commerce ולידים." />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                  <Save className="w-4 h-4" />
                  {t('settings.saveChanges')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{t('settings.currentPlan')}</h2>
                    <p className="text-sm text-gray-500 mt-1">{t('settings.planDesc', { plan: 'DIY' })}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium">{t('settings.nextBillingDate', { date: '1 Oct 2024' })}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { id: 'diy', name: 'DIY', price: '$200', desc: 'ניהול עצמי עם סיוע AI' },
                    { id: 'full', name: 'תמיכה מלאה', price: '$500', desc: 'תמיכה צמודה ואוטומציה', recommended: true },
                    { id: 'agency', name: 'סוכנות', price: 'מותאם', desc: 'פתרונות White-label' }
                  ].map((plan) => (
                    <div key={plan.id} className={cn("relative p-6 rounded-2xl border-2 transition-all", plan.id === 'diy' ? "border-indigo-600 bg-indigo-50/30" : "border-gray-100 hover:border-indigo-200")}>
                      {plan.recommended && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">{t('settings.recommended')}</span>}
                      <h3 className="font-bold text-gray-900">{plan.name}</h3>
                      <div className="my-2">
                        <span className="text-2xl font-black text-gray-900">{plan.price}</span>
                        <span className="text-xs text-gray-500">/mo</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">{plan.desc}</p>
                      <button className={cn("w-full py-2 rounded-lg text-xs font-bold transition-colors", plan.id === 'diy' ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")}>
                        {plan.id === 'diy' ? t('settings.currentPlan') : t('settings.upgrade')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('settings.paymentMethod')}</h2>
                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-white border border-gray-200 rounded flex items-center justify-center shadow-sm">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Visa מסתיים ב-4242</p>
                      <p className="text-xs text-gray-500">תוקף 12/2025</p>
                    </div>
                  </div>
                  <button className="text-xs font-bold text-indigo-600 hover:underline">{t('settings.edit')}</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{t('settings.notifications')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.notificationsDesc')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('settings.systemNotifications')}</h3>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.newAiRecs')}</p>
                      <p className="text-xs text-gray-500">{t('settings.newAiRecsDesc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.budgetExceeding')}</p>
                      <p className="text-xs text-gray-500">{t('settings.budgetExceedingDesc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.weeklyReports')}</p>
                      <p className="text-xs text-gray-500">{t('settings.weeklyReportsDesc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                  <Save className="w-4 h-4" />
                  {t('settings.saveChanges')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{t('settings.securityPrivacy')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.securityDesc')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('settings.changePassword')}</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.currentPassword')}</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.newPassword')}</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.confirmNewPassword')}</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">{t('settings.twoFactorAuth')}</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.twoFactorDesc')}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('settings.recommended')}</p>
                    </div>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      {t('settings.enable2fa')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                  <Save className="w-4 h-4" />
                  {t('settings.updatePassword')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
