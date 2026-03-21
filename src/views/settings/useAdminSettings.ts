import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
