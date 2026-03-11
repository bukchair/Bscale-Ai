import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Save, Bell, Lock, Globe, User, Building, CreditCard, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

export function Settings() {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'agency' | 'billing' | 'notifications' | 'security'>('profile');
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [firstName, setFirstName] = useState('אשר');
  const [lastName, setLastName] = useState('בוקשפן');
  const [email, setEmail] = useState('asher205@gmail.com');
  const [photoName, setPhotoName] = useState('');

  const [agencyName, setAgencyName] = useState('בוקשפן דיגיטל');
  const [agencyWebsite, setAgencyWebsite] = useState('https://example.com');
  const [agencyDescription, setAgencyDescription] = useState('סוכנות שיווק דיגיטלי המתמחה ב-E-commerce ולידים.');

  const [currentPlan, setCurrentPlan] = useState('diy');
  const [cardLast4, setCardLast4] = useState('4242');
  const [cardExpiry, setCardExpiry] = useState('12/2025');

  const [notifyAi, setNotifyAi] = useState(true);
  const [notifyBudget, setNotifyBudget] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('settings:preferences');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      setFirstName(data.firstName ?? 'אשר');
      setLastName(data.lastName ?? 'בוקשפן');
      setEmail(data.email ?? 'asher205@gmail.com');
      setPhotoName(data.photoName ?? '');
      setAgencyName(data.agencyName ?? 'בוקשפן דיגיטל');
      setAgencyWebsite(data.agencyWebsite ?? 'https://example.com');
      setAgencyDescription(data.agencyDescription ?? 'סוכנות שיווק דיגיטלי המתמחה ב-E-commerce ולידים.');
      setCurrentPlan(data.currentPlan ?? 'diy');
      setCardLast4(data.cardLast4 ?? '4242');
      setCardExpiry(data.cardExpiry ?? '12/2025');
      setNotifyAi(data.notifyAi ?? true);
      setNotifyBudget(data.notifyBudget ?? true);
      setNotifyWeekly(data.notifyWeekly ?? false);
      setTwoFactorEnabled(data.twoFactorEnabled ?? false);
    } catch (error) {
      console.error('Failed to parse settings preferences', error);
    }
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const persistSettings = (patch: Record<string, any>) => {
    const raw = localStorage.getItem('settings:preferences');
    const current = raw ? JSON.parse(raw) : {};
    localStorage.setItem('settings:preferences', JSON.stringify({ ...current, ...patch }));
  };

  const handleSaveProfile = () => {
    persistSettings({ firstName, lastName, email, photoName });
    showToast(t('settings.saveChanges'));
  };

  const handleSaveAgency = () => {
    persistSettings({ agencyName, agencyWebsite, agencyDescription });
    showToast(t('settings.saveChanges'));
  };

  const handleUpdateCard = () => {
    const last4 = window.prompt('4 ספרות אחרונות של כרטיס', cardLast4);
    if (!last4) return;
    const expiry = window.prompt('תוקף (MM/YYYY)', cardExpiry);
    if (!expiry) return;
    setCardLast4(last4);
    setCardExpiry(expiry);
    persistSettings({ cardLast4: last4, cardExpiry: expiry });
    showToast(t('settings.edit'));
  };

  const handleSaveNotifications = () => {
    persistSettings({ notifyAi, notifyBudget, notifyWeekly });
    showToast(t('settings.saveChanges'));
  };

  const handleToggleTwoFactor = () => {
    const next = !twoFactorEnabled;
    setTwoFactorEnabled(next);
    persistSettings({ twoFactorEnabled: next });
    showToast(next ? t('settings.enable2fa') : '2FA כובה');
  };

  const handleUpdatePassword = () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showToast(t('common.error'));
      return;
    }
    if (newPassword !== confirmNewPassword || newPassword.length < 8) {
      showToast(t('common.error'));
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    showToast(t('settings.updatePassword'));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold">
          {toast}
        </div>
      )}
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
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('settings.changePhoto')}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPhotoName(file.name);
                        persistSettings({ photoName: file.name });
                        showToast(t('settings.changePhoto'));
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-2">{t('settings.photoRequirements')}</p>
                    {photoName && <p className="text-[11px] text-indigo-600 mt-1">{photoName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.firstName')}</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.lastName')}</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.emailAddress')}</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
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
                  <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.website')}</label>
                  <input value={agencyWebsite} onChange={(e) => setAgencyWebsite(e.target.value)} type="url" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.shortDescription')}</label>
                  <textarea rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" value={agencyDescription} onChange={(e) => setAgencyDescription(e.target.value)} />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleSaveAgency}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
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
                    <div key={plan.id} className={cn("relative p-6 rounded-2xl border-2 transition-all", plan.id === currentPlan ? "border-indigo-600 bg-indigo-50/30" : "border-gray-100 hover:border-indigo-200")}>
                      {plan.recommended && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">{t('settings.recommended')}</span>}
                      <h3 className="font-bold text-gray-900">{plan.name}</h3>
                      <div className="my-2">
                        <span className="text-2xl font-black text-gray-900">{plan.price}</span>
                        <span className="text-xs text-gray-500">/mo</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">{plan.desc}</p>
                      <button
                        onClick={() => {
                          setCurrentPlan(plan.id);
                          persistSettings({ currentPlan: plan.id });
                          showToast(plan.id === currentPlan ? t('settings.currentPlan') : t('settings.upgrade'));
                        }}
                        className={cn("w-full py-2 rounded-lg text-xs font-bold transition-colors", plan.id === currentPlan ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50")}
                      >
                        {plan.id === currentPlan ? t('settings.currentPlan') : t('settings.upgrade')}
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
                      <p className="text-sm font-bold text-gray-900">Visa מסתיים ב-{cardLast4}</p>
                      <p className="text-xs text-gray-500">תוקף {cardExpiry}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpdateCard}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    {t('settings.edit')}
                  </button>
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
                      <input type="checkbox" className="sr-only peer" checked={notifyAi} onChange={(e) => setNotifyAi(e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.budgetExceeding')}</p>
                      <p className="text-xs text-gray-500">{t('settings.budgetExceedingDesc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={notifyBudget} onChange={(e) => setNotifyBudget(e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.weeklyReports')}</p>
                      <p className="text-xs text-gray-500">{t('settings.weeklyReportsDesc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={notifyWeekly} onChange={(e) => setNotifyWeekly(e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleSaveNotifications}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
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
                    <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.newPassword')}</label>
                    <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.confirmNewPassword')}</label>
                    <input value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">{t('settings.twoFactorAuth')}</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.twoFactorDesc')}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('settings.recommended')}</p>
                    </div>
                    <button
                      onClick={handleToggleTwoFactor}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {twoFactorEnabled ? `${t('settings.enable2fa')} ✓` : t('settings.enable2fa')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleUpdatePassword}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
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
