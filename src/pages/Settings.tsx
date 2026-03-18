import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Save, Bell, Lock, Globe, User, Building, CreditCard, Shield, Mail, Share2, UserPlus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  auth,
  db,
  getUserSharedAccess,
  removeUserSharedAccess,
  upsertUserSharedAccess,
  getOwnerInvitations,
  type SharedAccessEntry,
  type SharedAccessRole,
  type InvitationDoc,
} from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createPayPalCheckoutUrl, PAYPAL_BUSINESS_EMAIL } from '../lib/paypal';
import { useConnections } from '../contexts/ConnectionsContext';
import { useCurrency } from '../contexts/CurrencyContext';

export function Settings({ userProfile }: { userProfile?: { role?: string } | null }) {
  const { t, dir, language } = useLanguage();
  const isHebrew = language === 'he';
  const { currency, setCurrency, availableCurrencies, format: formatCurrency } = useCurrency();
  const {
    dataAccessMode,
    workspaceOwnerName,
    workspaceOwnerEmail,
  } = useConnections();
  const [activeTab, setActiveTab] = useState<'profile' | 'agency' | 'billing' | 'notifications' | 'security' | 'sharing'>('profile');
  const isAdmin = userProfile?.role === 'admin';
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;
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
  const [sharedAccessList, setSharedAccessList] = useState<SharedAccessEntry[]>([]);
  const [invitations, setInvitations] = useState<InvitationDoc[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<SharedAccessRole>('manager');
  const [isLoadingSharing, setIsLoadingSharing] = useState(false);
  const [isSavingSharing, setIsSavingSharing] = useState(false);
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);
  const starterPayPalUrl = createPayPalCheckoutUrl({
    itemName: 'BScale AI - Starter Plan (Monthly)',
    amount: 79,
    currency: 'USD',
    customId: 'settings_billing_starter',
  });
  const growthPayPalUrl = createPayPalCheckoutUrl({
    itemName: 'BScale AI - Growth Plan (Monthly)',
    amount: 149,
    currency: 'USD',
    customId: 'settings_billing_growth',
  });
  const scalePayPalUrl = createPayPalCheckoutUrl({
    itemName: 'BScale AI - Scale Plan (Monthly)',
    amount: 299,
    currency: 'USD',
    customId: 'settings_billing_scale',
  });

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
    if (!uid) return;
    setIsLoadingSharing(true);
    getUserSharedAccess(uid)
      .then((entries) => setSharedAccessList(entries))
      .catch((err) => {
        console.error('Failed to load shared access list:', err);
      })
      .finally(() => setIsLoadingSharing(false));
    // Load invitation statuses
    getOwnerInvitations(uid).then(setInvitations).catch(() => {});
  }, [uid]);

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
      setPaymentMessage(isHebrew ? 'טוקן הסליקה נשמר בהצלחה.' : 'Payment provider token saved successfully.');
    } catch (e) {
      console.error('Failed to save payment token', e);
      setPaymentMessage(isHebrew ? 'שמירת טוקן הסליקה נכשלה. נסה שוב מאוחר יותר.' : 'Failed to save payment provider token. Please try again later.');
    } finally {
      setIsSavingPayment(false);
      setTimeout(() => setPaymentMessage(null), 4000);
    }
  };

  const handleDemoAction = (label: string) => {
    alert(
      isHebrew
        ? `בגרסת הדמו הפעולה "${label}" מסומנת כהצלחה. בחיבור לשרת מלא נחבר אותה לעדכון אמיתי.`
        : `In demo mode, "${label}" is marked as successful. In a full backend connection, this will execute a real update.`
    );
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
      setEmailSettingsMessage(isHebrew ? 'הגדרות ה‑IMAP נשמרו בהצלחה.' : 'IMAP settings saved successfully.');
    } catch (e) {
      console.error('Failed to save email settings', e);
      setEmailSettingsMessage(isHebrew ? 'שמירת הגדרות ה‑IMAP נכשלה. נסה שוב מאוחר יותר.' : 'Failed to save IMAP settings. Please try again later.');
    } finally {
      setIsSavingEmailSettings(false);
      setTimeout(() => setEmailSettingsMessage(null), 4000);
    }
  };

  const showSharingMessage = (message: string) => {
    setSharingMessage(message);
    setTimeout(() => setSharingMessage(null), 4000);
  };

  // Build HTML invitation email for the given language
  const buildInvitationEmail = (
    lang: string,
    ownerEmail: string,
    invitedEmail: string,
    role: SharedAccessRole,
    acceptUrl: string
  ): { subject: string; html: string } => {
    const roleLabelMap: Record<string, { manager: string; viewer: string }> = {
      he: { manager: 'מנהל', viewer: 'צופה' },
      en: { manager: 'Manager', viewer: 'Viewer' },
      ru: { manager: 'Менеджер', viewer: 'Наблюдатель' },
      pt: { manager: 'Gerente', viewer: 'Visualizador' },
      fr: { manager: 'Gestionnaire', viewer: 'Observateur' },
    };
    const rl = roleLabelMap[lang] || roleLabelMap.en;
    const roleLabel = role === 'viewer' ? rl.viewer : rl.manager;

    const texts: Record<string, { subject: string; title: string; greeting: string; body: string; instructions: string; button: string; note: string; footer: string }> = {
      he: {
        subject: `הוזמנת ל-BScale AI`,
        title: 'הוזמנת ל-BScale AI',
        greeting: 'שלום,',
        body: `<strong>${ownerEmail}</strong> הזמין אותך להצטרף ל-BScale AI בתפקיד <strong>${roleLabel}</strong>.`,
        instructions: `כדי להצטרף, לחץ על הכפתור למטה. תצטרך להתחבר עם האימייל <strong>${invitedEmail}</strong>.`,
        button: 'אישור הצטרפות',
        note: 'לאחר האישור תוכל לגשת לסביבה המשותפת.',
        footer: 'אם לא ציפית להזמנה זו, ניתן להתעלם ממייל זה בבטחה.',
      },
      en: {
        subject: `You've been invited to BScale AI`,
        title: "You've been invited to BScale AI",
        greeting: 'Hello,',
        body: `<strong>${ownerEmail}</strong> has invited you to join BScale AI as a <strong>${roleLabel}</strong>.`,
        instructions: `To join, click the button below. You'll need to sign in with <strong>${invitedEmail}</strong>.`,
        button: 'Accept Invitation',
        note: "After accepting, you'll have access to the shared workspace.",
        footer: "If you didn't expect this invitation, you can safely ignore this email.",
      },
      ru: {
        subject: `Вас пригласили в BScale AI`,
        title: 'Вас пригласили в BScale AI',
        greeting: 'Здравствуйте,',
        body: `<strong>${ownerEmail}</strong> пригласил вас присоединиться к BScale AI в роли <strong>${roleLabel}</strong>.`,
        instructions: `Чтобы присоединиться, нажмите кнопку ниже. Вам нужно войти с помощью <strong>${invitedEmail}</strong>.`,
        button: 'Принять приглашение',
        note: 'После принятия у вас будет доступ к общей рабочей среде.',
        footer: 'Если вы не ожидали этого приглашения, просто проигнорируйте это письмо.',
      },
      pt: {
        subject: `Você foi convidado para o BScale AI`,
        title: 'Você foi convidado para o BScale AI',
        greeting: 'Olá,',
        body: `<strong>${ownerEmail}</strong> convidou você para entrar no BScale AI como <strong>${roleLabel}</strong>.`,
        instructions: `Para entrar, clique no botão abaixo. Você precisará fazer login com <strong>${invitedEmail}</strong>.`,
        button: 'Aceitar convite',
        note: 'Após aceitar, você terá acesso ao espaço de trabalho compartilhado.',
        footer: 'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
      },
      fr: {
        subject: `Vous avez été invité sur BScale AI`,
        title: 'Vous avez été invité sur BScale AI',
        greeting: 'Bonjour,',
        body: `<strong>${ownerEmail}</strong> vous a invité à rejoindre BScale AI en tant que <strong>${roleLabel}</strong>.`,
        instructions: `Pour rejoindre, cliquez sur le bouton ci-dessous. Vous devrez vous connecter avec <strong>${invitedEmail}</strong>.`,
        button: "Accepter l'invitation",
        note: "Après acceptation, vous aurez accès à l'espace de travail partagé.",
        footer: "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail en toute sécurité.",
      },
    };

    const tx = texts[lang] || texts.en;
    const isRTL = lang === 'he';
    const dir = isRTL ? 'rtl' : 'ltr';

    const html = `<!DOCTYPE html>
<html dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tx.subject}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;direction:${dir};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">BScale AI</h1>
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">AI-Powered Marketing Engine</p>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="color:#1a1a2e;font-size:22px;font-weight:700;margin:0 0 16px;">${tx.title}</h2>
<p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 12px;">${tx.greeting}</p>
<p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 12px;">${tx.body}</p>
<p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 32px;">${tx.instructions}</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 48px;border-radius:8px;">${tx.button}</a>
</td></tr></table>
<p style="color:#718096;font-size:13px;margin:28px 0 0;text-align:center;">${tx.note}</p>
</td></tr>
<tr><td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #e8ecef;">
<p style="color:#a0aec0;font-size:12px;margin:0;text-align:center;">${tx.footer}</p>
<p style="color:#a0aec0;font-size:12px;margin:8px 0 0;text-align:center;">© 2026 BScale AI · <a href="https://bscale.co.il" style="color:#4f46e5;text-decoration:none;">bscale.co.il</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    return { subject: tx.subject, html };
  };

  const handleAddSharedAccess = async () => {
    if (!uid) return;
    setIsSavingSharing(true);
    try {
      const { list: next, inviteToken } = await upsertUserSharedAccess(uid, shareEmail, shareRole, {
        uid,
        email: currentUser?.email,
      });
      setSharedAccessList(next);

      // Refresh invitations list
      getOwnerInvitations(uid).then(setInvitations).catch(() => {});

      // Send invitation email via connected Gmail account
      const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bscale.co.il';
      const acceptUrl = `${appOrigin}?accept_invite=${inviteToken}`;
      const ownerEmailAddr = currentUser?.email || '';
      const { subject, html } = buildInvitationEmail(language, ownerEmailAddr, shareEmail.trim().toLowerCase(), shareRole, acceptUrl);

      fetch('/api/connections/google/gmail-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: shareEmail.trim(), subject, body: html }),
      }).catch(() => {
        // Email send is best-effort — don't block the UI
      });

      setShareEmail('');
      showSharingMessage(isHebrew ? 'הרשאת השיתוף נשמרה ומייל הזמנה נשלח.' : 'Sharing permission saved and invitation email sent.');
    } catch (err) {
      console.error('Failed to add shared access:', err);
      showSharingMessage(isHebrew ? 'לא הצלחנו לשמור הרשאת שיתוף. בדוק את האימייל ונסה שוב.' : 'Could not save sharing permission. Check the email and try again.');
    } finally {
      setIsSavingSharing(false);
    }
  };

  const handleRemoveSharedAccess = async (email: string) => {
    if (!uid) return;
    setIsSavingSharing(true);
    try {
      const next = await removeUserSharedAccess(uid, email);
      setSharedAccessList(next);
      getOwnerInvitations(uid).then(setInvitations).catch(() => {});
      showSharingMessage(isHebrew ? 'הרשאת השיתוף הוסרה.' : 'Sharing permission removed.');
    } catch (err) {
      console.error('Failed to remove shared access:', err);
      showSharingMessage(isHebrew ? 'מחיקת הרשאת השיתוף נכשלה. נסה שוב.' : 'Failed to remove sharing permission. Please try again.');
    } finally {
      setIsSavingSharing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.settings') || (isHebrew ? 'הגדרות' : 'Settings')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('settings.subtitle') || (isHebrew ? 'נהל את הגדרות החשבון, הסוכנות וההתראות שלך.' : 'Manage your account, agency, and notifications settings.')}</p>
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
            {t('settings.personalProfile') || (isHebrew ? 'פרופיל אישי' : 'Personal Profile')}
          </button>
          <button
            onClick={() => setActiveTab('agency')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'agency' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Building className={cn("w-5 h-5", activeTab === 'agency' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.agencyDetails') || (isHebrew ? 'פרטי סוכנות' : 'Agency Details')}
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'billing' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <CreditCard className={cn("w-5 h-5", activeTab === 'billing' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.billingPlans') || (isHebrew ? 'חיוב ותוכניות' : 'Billing & Plans')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'notifications' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Bell className={cn("w-5 h-5", activeTab === 'notifications' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.notifications') || (isHebrew ? 'התראות' : 'Notifications')}
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'security' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Shield className={cn("w-5 h-5", activeTab === 'security' ? "text-indigo-600" : "text-gray-400")} />
            {t('settings.securityPrivacy') || (isHebrew ? 'אבטחה ופרטיות' : 'Security & Privacy')}
          </button>
          <button
            onClick={() => setActiveTab('sharing')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors text-start",
              activeTab === 'sharing' ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Share2 className={cn("w-5 h-5", activeTab === 'sharing' ? "text-indigo-600" : "text-gray-400")} />
            {isHebrew ? 'שיתוף גישה' : 'Shared Access'}
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          {dataAccessMode === 'shared' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-800">{isHebrew ? 'אתה עובד כרגע על סביבת נתונים משותפת.' : 'You are currently working in a shared workspace.'}</p>
              <p className="text-xs text-amber-700 mt-1">
                {isHebrew ? 'בעל החשבון:' : 'Workspace owner:'} {workspaceOwnerName || '—'} {workspaceOwnerEmail ? `(${workspaceOwnerEmail})` : ''}
              </p>
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{t('settings.personalProfile') || (isHebrew ? 'פרופיל אישי' : 'Personal Profile')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.updateProfileDesc') || (isHebrew ? 'עדכן את פרטי הקשר והתמונה שלך.' : 'Update your contact details and profile image.')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold">
                    אב
                  </div>
                  <div>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      {t('settings.changePhoto') || (isHebrew ? 'שנה תמונה' : 'Change photo')}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">{t('settings.photoRequirements') || (isHebrew ? 'JPG, GIF או PNG. מקסימום 2MB.' : 'JPG, GIF, or PNG. Max 2MB.')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.firstName') || (isHebrew ? 'שם פרטי' : 'First name')}</label>
                    <input type="text" defaultValue="אשר" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.lastName') || (isHebrew ? 'שם משפחה' : 'Last name')}</label>
                    <input type="text" defaultValue="בוקשפן" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.emailAddress') || (isHebrew ? 'כתובת אימייל' : 'Email address')}</label>
                    <input type="email" defaultValue="asher205@gmail.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">{isHebrew ? 'מטבע תצוגה במערכת' : 'Display currency'}</label>
                    <div className="relative">
                      <Globe className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400", dir === 'rtl' ? 'right-3' : 'left-3')} />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className={cn(
                          "w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
                          dir === 'rtl' ? 'pr-10' : 'pl-10'
                        )}
                      >
                        {availableCurrencies.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.code} - {option.label} ({option.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-500">
                      {isHebrew
                        ? 'ניתן לבחור כל מטבע נתמך. הבחירה משפיעה על כל הסכומים במערכת.'
                        : 'You can choose any supported currency. This affects amounts across the system.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDemoAction(isHebrew ? 'שמירת פרופיל אישי' : 'Save personal profile')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {t('settings.saveChanges') || (isHebrew ? 'שמור שינויים' : 'Save changes')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'agency' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{t('settings.agencyDetails') || (isHebrew ? 'פרטי סוכנות' : 'Agency details')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.agencyDetailsDesc') || (isHebrew ? 'נהל את פרטי העסק והמותג של הסוכנות שלך.' : 'Manage your agency business and brand details.')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.agencyName') || (isHebrew ? 'שם הסוכנות' : 'Agency name')}</label>
                  <input type="text" defaultValue="בוקשפן דיגיטל" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.website') || (isHebrew ? 'אתר אינטרנט' : 'Website')}</label>
                  <input type="url" defaultValue="https://example.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('settings.shortDescription') || (isHebrew ? 'תיאור קצר' : 'Short description')}</label>
                  <textarea rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" defaultValue="סוכנות שיווק דיגיטלי המתמחה ב-E-commerce ולידים." />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDemoAction(isHebrew ? 'שמירת פרטי סוכנות' : 'Save agency details')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {t('settings.saveChanges') || (isHebrew ? 'שמור שינויים' : 'Save changes')}
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
                    <h2 className="text-lg font-bold text-gray-900">{isHebrew ? 'הצטרפות לשירות בתשלום' : 'Join paid plan'}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {isHebrew
                        ? 'בחר תוכנית, מטבע ותקופת חיוב - והתאם את המנוי שלך ללקוחות מכל העולם.'
                        : 'Choose a plan, currency, and billing cycle to fit your global customers.'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{isHebrew ? 'מטבע' : 'Currency'}</span>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white max-w-[180px]"
                      >
                        {availableCurrencies.map((option) => (
                          <option key={`billing-currency-${option.code}`} value={option.code}>
                            {option.code} {option.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{isHebrew ? 'חיוב' : 'Billing'}</span>
                      <div className="inline-flex rounded-full bg-gray-100 p-1">
                        <button className="px-3 py-1 text-xs font-bold rounded-full bg-white shadow-sm">
                          {isHebrew ? 'חודשי' : 'Monthly'}
                        </button>
                        <button className="px-3 py-1 text-xs font-bold rounded-full text-gray-600">
                          {isHebrew ? 'שנתי (‎15%‑)' : 'Yearly (15%-)'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'starter', name: 'Starter', priceAmount: 79, desc: 'עד 3 חנויות, חיבור ל‑Google + Meta + WooCommerce.' },
                    { id: 'growth', name: 'Growth', priceAmount: 149, desc: '5‑10 חנויות, AI מתקדם ותמיכה מועדפת.', recommended: true },
                    { id: 'scale', name: 'Scale', priceAmount: 299, desc: 'מספר חנויות בלתי מוגבל ו‑SLA מותאם.' }
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
                        <span className="text-2xl font-black text-gray-900">{formatCurrency(plan.priceAmount)}</span>
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
                    <div className="rounded-xl border border-[#0070ba]/30 bg-[#0070ba]/5 p-3 space-y-2">
                      <p className="text-xs font-bold text-[#0070ba]">אפשר גם לשלם דרך PayPal</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <a
                          href={starterPayPalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-center py-2 rounded-lg bg-white border border-[#0070ba] text-[#0070ba] text-xs font-bold hover:bg-[#0070ba]/10 transition-colors"
                        >
                          Starter ($79)
                        </a>
                        <a
                          href={growthPayPalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-center py-2 rounded-lg bg-white border border-[#0070ba] text-[#0070ba] text-xs font-bold hover:bg-[#0070ba]/10 transition-colors"
                        >
                          Growth ($149)
                        </a>
                        <a
                          href={scalePayPalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-center py-2 rounded-lg bg-white border border-[#0070ba] text-[#0070ba] text-xs font-bold hover:bg-[#0070ba]/10 transition-colors"
                        >
                          Scale ($299)
                        </a>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        חשבון היעד לתשלום: <span dir="ltr">{PAYPAL_BUSINESS_EMAIL}</span>
                      </p>
                    </div>
                    <div className="text-sm font-medium text-gray-900 flex items-center justify-between pt-2 border-t border-gray-100">
                      <span>סיכום חיוב היום</span>
                      <span className="font-black text-indigo-600">{formatCurrency(149)}</span>
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
                        isHebrew ? 'שומר...' : 'Saving...'
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {isHebrew ? 'שמור טוקן סליקה' : 'Save payment token'}
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
                <h2 className="text-lg font-bold text-gray-900">{t('settings.notifications') || (isHebrew ? 'התראות' : 'Notifications')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.notificationsDesc') || (isHebrew ? 'בחר אילו התראות תרצה לקבל ובאיזה ערוץ.' : 'Choose which notifications to receive and through which channel.')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('settings.systemNotifications') || (isHebrew ? 'התראות מערכת' : 'System notifications')}</h3>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.newAiRecs') || (isHebrew ? 'המלצות AI חדשות' : 'New AI recommendations')}</p>
                      <p className="text-xs text-gray-500">{t('settings.newAiRecsDesc') || (isHebrew ? 'קבל התראה כאשר המערכת מזהה הזדמנויות אופטימיזציה.' : 'Get alerted when the system identifies optimization opportunities.')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.budgetExceeding') || (isHebrew ? 'חריגות תקציב' : 'Budget exceeding')}</p>
                      <p className="text-xs text-gray-500">{t('settings.budgetExceedingDesc') || (isHebrew ? 'התראות מיידיות כאשר קמפיין חורג מהתקציב היומי.' : 'Immediate alerts when a campaign exceeds daily budget.')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.weeklyReports') || (isHebrew ? 'דוחות שבועיים' : 'Weekly reports')}</p>
                      <p className="text-xs text-gray-500">{t('settings.weeklyReportsDesc') || (isHebrew ? 'קבל סיכום ביצועים שבועי למייל.' : 'Receive a weekly performance summary by email.')}</p>
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
                          {isHebrew ? 'הגדרות דוא״ל (Gmail IMAP / חיבור התראות)' : 'Email settings (Gmail IMAP / notifications)'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {isHebrew
                            ? 'הגדר תיבת Gmail ייעודית לשליחת התראות והודעות מהמערכת. אפשר להזין פרטי IMAP ידנית או להתחבר בהמשך דרך Google OAuth.'
                            : 'Set a dedicated Gmail inbox for system alerts and notifications. You can enter IMAP details manually or connect later via Google OAuth.'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">{isHebrew ? 'משתמש Gmail (כתובת מלאה)' : 'Gmail user (full address)'}</label>
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
                        <label className="text-xs font-medium text-gray-700">{isHebrew ? 'שרת IMAP' : 'IMAP host'}</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={imapHost}
                          onChange={(e) => setImapHost(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">{isHebrew ? 'פורט' : 'Port'}</label>
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
                        <span className="font-semibold">{isHebrew ? 'התחברות עם Google (דמו):' : 'Connect with Google (demo):'}</span>
                        <button
                          type="button"
                          onClick={() =>
                            alert(
                              isHebrew
                                ? 'בגרסת הדמו הכפתור רק מסמן התחברות. בחיבור מלא נפתח כאן OAuth מול Google לחשבון הדוא״ל.'
                                : 'In demo mode, this button only simulates a connection. In full mode, Google OAuth for the mailbox will open here.'
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          {isHebrew ? 'התחברות לחשבון Google' : 'Connect Google account'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveEmailSettings}
                        disabled={isSavingEmailSettings || isLoadingEmailSettings}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {isSavingEmailSettings ? (isHebrew ? 'שומר...' : 'Saving...') : <Save className="w-4 h-4" />}
                        {isSavingEmailSettings ? (isHebrew ? 'שומר הגדרות דוא״ל' : 'Saving email settings') : (isHebrew ? 'שמור הגדרות דוא״ל' : 'Save email settings')}
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
                  onClick={() => handleDemoAction(isHebrew ? 'שמירת הגדרות התראות' : 'Save notifications settings')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {t('settings.saveChanges') || (isHebrew ? 'שמור שינויים' : 'Save changes')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sharing' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-white/10">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{isHebrew ? 'שיתוף מידע עם משתמשים נוספים' : 'Share workspace access'}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {isHebrew
                    ? 'בעל החנות יכול לשתף את נתוני המערכת עם מנהל חנות או עובד נוסף לפי אימייל.'
                    : 'The store owner can share workspace data with managers or team members by email.'}
                </p>
              </div>
              <div className="p-6 space-y-5">
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-700/40 bg-indigo-50/50 dark:bg-indigo-900/20 p-4">
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">{isHebrew ? 'איך זה עובד' : 'How it works'}</p>
                  <p className="text-xs text-indigo-800 dark:text-indigo-400 mt-1 leading-relaxed">
                    {isHebrew
                      ? 'הזן אימייל של המשתמש שצריך גישה. ברגע שהוא יתחבר עם אותו אימייל, הוא יעבוד על נתוני החנות שלך.'
                      : 'Enter the user email that needs access. Once they sign in with that email, they will work on your store data.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{isHebrew ? 'אימייל משתמש לשיתוף' : 'User email to share'}</label>
                    <input
                      type="email"
                      dir="ltr"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="manager@store.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{isHebrew ? 'הרשאה' : 'Permission'}</label>
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value as SharedAccessRole)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="manager">{isHebrew ? 'Manager - יכול לערוך ולנהל' : 'Manager - can edit and manage'}</option>
                      <option value="viewer">{isHebrew ? 'Viewer - צפייה בלבד ללא שינוי נתונים' : 'Viewer - view only, no edits'}</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddSharedAccess}
                    disabled={isSavingSharing || !shareEmail.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <UserPlus className="w-4 h-4" />
                    {isSavingSharing ? (isHebrew ? 'שומר...' : 'Saving...') : (isHebrew ? 'הוסף משתמש לשיתוף' : 'Add shared user')}
                  </button>
                </div>

                {sharingMessage && (
                  <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-700/40 rounded-lg px-3 py-2">
                    {sharingMessage}
                  </div>
                )}

                <div className="border-t border-gray-100 dark:border-white/10 pt-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{isHebrew ? 'משתמשים עם גישה' : 'Users with access'}</h3>
                  {isLoadingSharing ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{isHebrew ? 'טוען הרשאות שיתוף...' : 'Loading sharing permissions...'}</p>
                  ) : !sharedAccessList.length ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{isHebrew ? 'עדיין לא הוגדרו משתמשים לשיתוף.' : 'No shared users configured yet.'}</p>
                  ) : (
                    <div className="space-y-2">
                      {sharedAccessList.map((entry) => {
                        const inv = invitations.find((i) => i.invitedEmail === entry.email.toLowerCase());
                        const isAccepted = inv?.status === 'accepted';
                        return (
                          <div
                            key={entry.email}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate" dir="ltr">{entry.email}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {entry.role === 'manager'
                                    ? (isHebrew ? 'מנהל' : 'Manager')
                                    : (isHebrew ? 'צופה' : 'Viewer')}
                                </span>
                                {isAccepted ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700/40">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {isHebrew ? 'פעיל' : 'Active'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/40">
                                    <Clock className="w-3 h-3" />
                                    {isHebrew ? 'ממתין לאישור' : 'Pending'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSharedAccess(entry.email)}
                              disabled={isSavingSharing}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-60 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isHebrew ? 'הסר' : 'Remove'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{t('settings.securityPrivacy') || (isHebrew ? 'אבטחה ופרטיות' : 'Security & privacy')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('settings.securityDesc') || (isHebrew ? 'נהל את הסיסמה והגדרות האבטחה של החשבון.' : 'Manage account password and security settings.')}</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('settings.changePassword') || (isHebrew ? 'שינוי סיסמה' : 'Change password')}</h3>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.currentPassword') || (isHebrew ? 'סיסמה נוכחית' : 'Current password')}</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.newPassword') || (isHebrew ? 'סיסמה חדשה' : 'New password')}</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.confirmNewPassword') || (isHebrew ? 'אימות סיסמה חדשה' : 'Confirm new password')}</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">{t('settings.twoFactorAuth') || (isHebrew ? 'אימות דו-שלבי (2FA)' : 'Two-factor authentication (2FA)')}</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('settings.twoFactorDesc') || (isHebrew ? 'הגן על החשבון שלך עם שכבת אבטחה נוספת.' : 'Protect your account with an extra security layer.')}</p>
                      <p className="text-xs text-gray-500 mt-1">{isHebrew ? 'מומלץ מאוד להפעיל אימות דו-שלבי.' : 'Highly recommended to enable 2FA.'}</p>
                    </div>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      {t('settings.enable2fa') || (isHebrew ? 'הפעל 2FA' : 'Enable 2FA')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => handleDemoAction(isHebrew ? 'עדכון סיסמה ואבטחה' : 'Update password and security')}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {t('settings.updatePassword') || (isHebrew ? 'עדכן סיסמה' : 'Update password')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
