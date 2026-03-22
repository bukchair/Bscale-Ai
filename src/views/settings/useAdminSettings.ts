import { useState, useEffect } from 'react';

export interface UseAdminSettingsProps {
  isAdmin: boolean;
  isHebrew: boolean;
}

export function useAdminSettings({ isAdmin, isHebrew }: UseAdminSettingsProps) {
  // Payment
  const [paymentToken, setPaymentToken] = useState('');
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  // Email / IMAP
  const [imapUser, setImapUser] = useState('');
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState('993');
  const [isLoadingEmailSettings, setIsLoadingEmailSettings] = useState(false);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);
  const [emailSettingsMessage, setEmailSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setIsLoadingPayment(true);
    setIsLoadingEmailSettings(true);
    fetch('/api/admin/settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { settings?: Record<string, unknown> }) => {
        const s = d.settings ?? {};
        if (typeof s.paymentProviderToken === 'string') setPaymentToken(s.paymentProviderToken);
        if (typeof s.imapUser === 'string') setImapUser(s.imapUser);
        if (typeof s.imapHost === 'string') setImapHost(s.imapHost);
        if (typeof s.imapPort === 'string') setImapPort(s.imapPort);
      })
      .catch((e) => console.error('Failed to load admin settings', e))
      .finally(() => { setIsLoadingPayment(false); setIsLoadingEmailSettings(false); });
  }, [isAdmin]);

  const handleSavePaymentToken = async () => {
    if (!isAdmin) return;
    setIsSavingPayment(true);
    setPaymentMessage(null);
    try {
      await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentProviderToken: paymentToken || null }),
      });
      setPaymentMessage(isHebrew ? 'טוקן הסליקה נשמר בהצלחה.' : 'Payment provider token saved successfully.');
    } catch (e) {
      console.error('Failed to save payment token', e);
      setPaymentMessage(isHebrew ? 'שמירת טוקן הסליקה נכשלה. נסה שוב מאוחר יותר.' : 'Failed to save payment provider token. Please try again later.');
    } finally {
      setIsSavingPayment(false);
      setTimeout(() => setPaymentMessage(null), 4000);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!isAdmin) return;
    setIsSavingEmailSettings(true);
    setEmailSettingsMessage(null);
    try {
      await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imapUser: imapUser || null,
          imapHost: imapHost || null,
          imapPort: imapPort || null,
        }),
      });
      setEmailSettingsMessage(isHebrew ? 'הגדרות ה‑IMAP נשמרו בהצלחה.' : 'IMAP settings saved successfully.');
    } catch (e) {
      console.error('Failed to save email settings', e);
      setEmailSettingsMessage(isHebrew ? 'שמירת הגדרות ה‑IMAP נכשלה. נסה שוב מאוחר יותר.' : 'Failed to save IMAP settings. Please try again later.');
    } finally {
      setIsSavingEmailSettings(false);
      setTimeout(() => setEmailSettingsMessage(null), 4000);
    }
  };

  return {
    // payment
    paymentToken, setPaymentToken,
    isLoadingPayment,
    isSavingPayment,
    paymentMessage,
    handleSavePaymentToken,
    // email / IMAP
    imapUser, setImapUser,
    imapHost, setImapHost,
    imapPort, setImapPort,
    isLoadingEmailSettings,
    isSavingEmailSettings,
    emailSettingsMessage,
    handleSaveEmailSettings,
  };
}
