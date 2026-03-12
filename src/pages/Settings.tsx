import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Save, Bell, Lock, Globe, User, Building, CreditCard, Shield, Mail } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function Settings({ userProfile }: { userProfile?: { role?: string } | null }) {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'agency' | 'billing' | 'notifications' | 'security'>('profile');
  const isAdmin = userProfile?.role === 'admin';
  const [paymentToken, setPaymentToken] = useState('');
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const [isLoadingEmailSettings, setIsLoadingEmailSettings] = useState(false);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);
  const [emailSettingsMessage, setEmailSettingsMessage] = useState<string | null>(null);
  const [imapUser, setImapUser] = useState('');
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState('993');

  useEffect(() => {
    if (!isAdmin) return;
    setIsLoadingPayment(true);
    const ref = doc(db, 'appSettings', 'payment');
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as { providerToken?: string };
          if (data?.providerToken) setPaymentToken(data.providerToken);
        }
      })
      .finally(() => setIsLoadingPayment(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setIsLoadingEmailSettings(true);
    const ref = doc(db, 'appSettings', 'email');
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as { imapUser?: string; imapHost?: string; imapPort?: string };
          if (data?.imapUser) setImapUser(data.imapUser);
          if (data?.imapHost) setImapHost(data.imapHost);
          if (data?.imapPort) setImapPort(data.imapPort);
        }
      })
      .finally(() => setIsLoadingEmailSettings(false));
  }, [isAdmin]);

  const handleSavePaymentToken = async () => {
    if (!isAdmin) return;
    setIsSavingPayment(true);
    setPaymentMessage(null);
    try {
      const ref = doc(db, 'appSettings', 'payment');
      await setDoc(ref, { providerToken: paymentToken || null }, { merge: true });
      setPaymentMessage('טוקן הסליקה נשמר בהצלחה.');
    } catch (e) {
      console.error('Failed to save payment token', e);
      setPaymentMessage('שמירת טוקן הסליקה נכשלה. נסה שוב מאוחר יותר.');
    } finally {
      setIsSavingPayment(false);
      setTimeout(() => setPaymentMessage(null), 4000);
    }
  };

  const handleDemoAction = (label: string) => {
    alert(`בגרסת הדמו הפעולה "${label}" מסומנת כהצלחה. בחיבור לשרת מלא נחבר אותה לעדכון אמיתי.`);
  };

  const handleSaveEmailSettings = async () => {
    if (!isAdmin) return;
    setIsSavingEmailSettings(true);
    setEmailSettingsMessage(null);
    try {
      const ref = doc(db, 'appSettings', 'email');
      await setDoc(
        ref,
        {
          imapUser: imapUser || null,
          imapHost: imapHost || null,
          imapPort: imapPort || null,
        },
        { merge: true }
      );
      setEmailSettingsMessage('הגדרות ה‑IMAP נשמרו בהצלחה.');
    } catch (e) {
      console.error('Failed to save email settings', e);
      setEmailSettingsMessage('שמירת הגדרות ה‑IMAP נכשלה. נסה שוב מאוחר יותר.');
    } finally {
      setIsSavingEmailSettings(false);
      setTimeout(() => setEmailSettingsMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.settings') || 'הגדרות'}</h1>
        <p className="text-sm text-gray-500 mt-1">נהל את הגדרות החשבון, הסוכנות וההתראות שלך.</p>
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
            פרופיל אישי
          </button>
          <button
            onClick={() => setActiveTab('agency')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'agency' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Building className={cn("w-5 h-5", activeTab === 'agency' ? "text-indigo-600" : "text-gray-400")} />
            פרטי סוכנות
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'billing' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <CreditCard className={cn("w-5 h-5", activeTab === 'billing' ? "text-indigo-600" : "text-gray-400")} />
            חיוב ותוכניות
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'notifications' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Bell className={cn("w-5 h-5", activeTab === 'notifications' ? "text-indigo-600" : "text-gray-400")} />
            התראות
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'security' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Shield className={cn("w-5 h-5", activeTab === 'security' ? "text-indigo-600" : "text-gray-400")} />
            אבטחה ופרטיות
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">פרופיל אישי</h2>
                <p className="text-sm text-gray-500 mt-1">עדכן את פרטי הקשר והתמונה שלך.</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold">
                    אב
                  </div>
                  <div>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      שנה תמונה
                    </button>
                    <p className="text-xs text-gray-500 mt-2">JPG, GIF או PNG. מקסימום 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">שם פרטי</label>
                    <input type="text" defaultValue="אשר" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">שם משפחה</label>
                    <input type="text" defaultValue="בוקשפן" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">כתובת אימייל</label>
                    <input type="email" defaultValue="asher205@gmail.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDemoAction('שמירת פרופיל אישי')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  שמור שינויים
                </button>
              </div>
            </div>
          )}

          {activeTab === 'agency' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">פרטי סוכנות</h2>
                <p className="text-sm text-gray-500 mt-1">נהל את פרטי העסק והמותג של הסוכנות שלך.</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">שם הסוכנות</label>
                  <input type="text" defaultValue="בוקשפן דיגיטל" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">אתר אינטרנט</label>
                  <input type="url" defaultValue="https://example.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">תיאור קצר</label>
                  <textarea rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" defaultValue="סוכנות שיווק דיגיטלי המתמחה ב-E-commerce ולידים." />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDemoAction('שמירת פרטי סוכנות')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  שמור שינויים
                </button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Intl subscription signup */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">הצטרפות לשירות בתשלום</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      בחר תוכנית, מטבע ותקופת חיוב – והתאם את המנוי שלך ללקוחות מכל העולם.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">מטבע</span>
                      <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white">
                        <option>USD $</option>
                        <option>EUR €</option>
                        <option>ILS ₪</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">חיוב</span>
                      <div className="inline-flex rounded-full bg-gray-100 p-1">
                        <button className="px-3 py-1 text-xs font-bold rounded-full bg-white shadow-sm">
                          חודשי
                        </button>
                        <button className="px-3 py-1 text-xs font-bold rounded-full text-gray-600">
                          שנתי (‎15%‑)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'starter', name: 'Starter', price: '$79', desc: 'עד 3 חנויות, חיבור ל‑Google + Meta + WooCommerce.' },
                    { id: 'growth', name: 'Growth', price: '$149', desc: '5‑10 חנויות, AI מתקדם ותמיכה מועדפת.', recommended: true },
                    { id: 'scale', name: 'Scale', price: '$299', desc: 'מספר חנויות בלתי מוגבל ו‑SLA מותאם.' }
                  ].map((plan) => (
                    <div
                      key={plan.id}
                      className={cn(
                        'relative p-6 rounded-2xl border-2 transition-all',
                        plan.id === 'growth' ? 'border-indigo-600 bg-indigo-50/40' : 'border-gray-100 hover:border-indigo-200'
                      )}
                    >
                      {plan.recommended && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                          מומלץ
                        </span>
                      )}
                      <h3 className="font-bold text-gray-900">{plan.name}</h3>
                      <div className="my-2">
                        <span className="text-2xl font-black text-gray-900">{plan.price}</span>
                        <span className="text-xs text-gray-500"> / חודש</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">{plan.desc}</p>
                      <button className="w-full py-2 rounded-lg text-xs font-bold transition-colors bg-indigo-600 text-white hover:bg-indigo-700">
                        בחר {plan.name}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-900">פרטי חיוב</h3>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">שם החברה / הסוכנות</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="לדוגמה: BScale Digital Ltd."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">אימייל לחיוב</label>
                      <input
                        type="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="billing@company.com"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700">מדינה</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Israel"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700">עיר</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Tel Aviv"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700">רחוב וכתובת</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Herzl 10"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700">מיקוד</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="1234567"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">VAT / Tax ID (אופציונלי)</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="IL123456789"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-900">אמצעי תשלום</h3>
                    <p className="text-xs text-gray-500">
                      שדה זה מיועד להטמעת רכיב הסליקה (כמו Stripe Elements) בצד הלקוח. אין לשמור כאן פרטי כרטיס מלאים.
                    </p>
                    <div className="h-28 rounded-xl border border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-xs text-gray-400">
                      Placeholder לרכיב כרטיס אשראי / ספק סליקה
                    </div>
                    <div className="text-sm font-medium text-gray-900 flex items-center justify-between pt-2 border-t border-gray-100">
                      <span>סיכום חיוב היום</span>
                      <span className="font-black text-indigo-600">$149.00</span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      החיוב מתבצע במטבע שבחרת. יתכנו הפרשי שער והעמלות מצד ספק האשראי שלך.
                    </p>
                    <div className="flex items-start gap-2 mt-2">
                      <input id="accept-terms" type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                      <label htmlFor="accept-terms" className="text-xs text-gray-600">
                        אני מאשר/ת שקראתי והסכמתי ל{' '}
                        <a href="/terms" target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                          תנאי השימוש
                        </a>{' '}
                        ו{' '}
                        <a href="/privacy-policy" target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                          מדיניות הפרטיות
                        </a>
                        .
                      </label>
                    </div>
                    <button
                      onClick={() => handleDemoAction('הפעלת מנוי בתשלום (דמו)')}
                      className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
                    >
                      התחלת מנוי בתשלום
                    </button>
                    <p className="text-[11px] text-gray-400 mt-1">
                      ניתן לבטל את המנוי בכל עת דרך מסך ההגדרות. ביטול ייכנס לתוקף בסוף תקופת החיוב הנוכחית.
                    </p>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">הגדרות סליקה (טוקן ספק תשלומים)</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        הגדר כאן טוקן API של ספק הסליקה (למשל Stripe / Tranzila / Max). ערך זה נשמר באופן מרכזי עבור כל החשבון.
                      </p>
                    </div>
                    <Shield className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                      טוקן סליקה (Server-side)
                    </label>
                    <input
                      type="password"
                      value={paymentToken}
                      onChange={(e) => setPaymentToken(e.target.value)}
                      placeholder="sk_live_..."
                      disabled={isLoadingPayment || isSavingPayment}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-gray-50"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      שים לב: הטוקן נשמר במסמך <code>appSettings/payment</code> ב‑Firestore ומוגן לפי הרשאות אדמין.
                    </p>
                    <button
                      onClick={handleSavePaymentToken}
                      disabled={isSavingPayment}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isSavingPayment ? (
                        'שומר...'
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          שמור טוקן סליקה
                        </>
                      )}
                    </button>
                  </div>
                  {paymentMessage && (
                    <div className="mt-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                      {paymentMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">התראות</h2>
                <p className="text-sm text-gray-500 mt-1">בחר אילו התראות תרצה לקבל ובאיזה ערוץ.</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">התראות מערכת</h3>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">המלצות AI חדשות</p>
                      <p className="text-xs text-gray-500">קבל התראה כאשר המערכת מזהה הזדמנויות אופטימיזציה.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">חריגות תקציב</p>
                      <p className="text-xs text-gray-500">התראות מיידיות כאשר קמפיין חורג מהתקציב היומי.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">דוחות שבועיים</p>
                      <p className="text-xs text-gray-500">קבל סיכום ביצועים שבועי למייל.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-indigo-500" />
                          הגדרות דוא״ל (Gmail IMAP / חיבור התראות)
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          הגדר תיבת Gmail ייעודית לשליחת התראות והודעות מהמערכת. אפשר להזין פרטי IMAP ידנית או להתחבר בהמשך דרך Google OAuth.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">משתמש Gmail (כתובת מלאה)</label>
                        <input
                          type="email"
                          dir="ltr"
                          value={imapUser}
                          onChange={(e) => setImapUser(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="alerts@yourdomain.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">שרת IMAP</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={imapHost}
                          onChange={(e) => setImapHost(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">פורט</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={imapPort}
                          onChange={(e) => setImapPort(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-semibold">התחברות עם Google (דמו):</span>
                        <button
                          type="button"
                          onClick={() =>
                            alert(
                              'בגרסת הדמו הכפתור רק מסמן התחברות. בחיבור מלא נפתח כאן OAuth מול Google לחשבון הדוא״ל.'
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          התחברות לחשבון Google
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveEmailSettings}
                        disabled={isSavingEmailSettings || isLoadingEmailSettings}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {isSavingEmailSettings ? 'שומר...' : <Save className="w-4 h-4" />}
                        {isSavingEmailSettings ? 'שומר הגדרות דוא״ל' : 'שמור הגדרות דוא״ל'}
                      </button>
                    </div>
                    {emailSettingsMessage && (
                      <div className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                        {emailSettingsMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDemoAction('שמירת הגדרות התראות')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  שמור שינויים
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">אבטחה ופרטיות</h2>
                <p className="text-sm text-gray-500 mt-1">נהל את הסיסמה והגדרות האבטחה של החשבון.</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">שינוי סיסמה</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">סיסמה נוכחית</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">סיסמה חדשה</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">אימות סיסמה חדשה</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">אימות דו-שלבי (2FA)</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">הגן על החשבון שלך עם שכבת אבטחה נוספת.</p>
                      <p className="text-xs text-gray-500 mt-1">מומלץ מאוד להפעיל אימות דו-שלבי.</p>
                    </div>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      הפעל 2FA
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDemoAction('עדכון סיסמה ואבטחה')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  עדכן סיסמה
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
