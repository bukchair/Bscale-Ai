import React from 'react';
import { Lock, Mail, ArrowRight, LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { auth, signOut, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { createPayPalCheckoutUrl, PAYPAL_BUSINESS_EMAIL } from '../lib/paypal';

interface SubscriptionRequiredProps {
  onGoToPricing: () => void;
}

export function SubscriptionRequired({ onGoToPricing }: SubscriptionRequiredProps) {
  const { t, dir, language } = useLanguage();
  const payPalButtonText =
    language === 'he'
      ? 'תשלום ישיר ב‑PayPal'
      : language === 'ru'
        ? 'Оплатить напрямую через PayPal'
        : language === 'pt'
          ? 'Pagar direto com PayPal'
          : language === 'fr'
            ? 'Payer directement avec PayPal'
            : 'Pay directly with PayPal';
  const payPalSubtitle =
    language === 'he'
      ? `התשלום יועבר לחשבון ${PAYPAL_BUSINESS_EMAIL}`
      : language === 'ru'
        ? `Оплата будет отправлена на аккаунт ${PAYPAL_BUSINESS_EMAIL}`
        : language === 'pt'
          ? `O pagamento será enviado para ${PAYPAL_BUSINESS_EMAIL}`
          : language === 'fr'
            ? `Le paiement sera envoyé au compte ${PAYPAL_BUSINESS_EMAIL}`
            : `Payment will be sent to ${PAYPAL_BUSINESS_EMAIL}`;
  const payPalUrl = createPayPalCheckoutUrl({
    itemName: 'BScale AI - Subscription payment',
    currency: 'ILS',
    customId: 'subscription_required_entry',
  });

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleEnterDemo = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          subscriptionStatus: 'demo',
          plan: 'demo',
        },
        { merge: true }
      );
      window.location.reload();
    } catch (err) {
      console.error('Failed to activate demo mode:', err);
      alert('הפעלת חשבון הדמו נכשלה. נסה שוב מאוחר יותר.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6" dir={dir}>
      <div className="fixed top-4 right-4 flex items-center gap-3">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
          <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900 dark:text-white">
          {t('subscription.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {t('subscription.subtitle')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onGoToPricing}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          >
            {t('subscription.ctaPlans')}
            <ArrowRight className="w-5 h-5" />
          </button>
          <a
            href={payPalUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold border-2 border-[#0070ba] text-[#0070ba] hover:bg-[#0070ba]/10 transition-colors"
          >
            {payPalButtonText}
          </a>
          <p className="text-[11px] text-gray-500">{payPalSubtitle}</p>
          <button
            onClick={handleEnterDemo}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold border-2 border-dashed border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-sm"
          >
            {t('subscription.ctaDemo') || 'היכנס לחשבון דמו (ללא חיבור פלטפורמות)'}
          </button>
          <a
            href="mailto:contact@bscale.ai?subject=בקשת מנוי - BScale AI"
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold border-2 border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <Mail className="w-5 h-5" />
            {t('subscription.ctaContact')}
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('subscription.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
