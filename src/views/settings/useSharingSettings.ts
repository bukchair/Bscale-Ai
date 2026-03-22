import { useState, useEffect } from 'react';

export type SharedAccessRole = 'manager' | 'viewer';

export interface SharedAccessEntry {
  invitedEmail: string;
  role: SharedAccessRole;
  status: string;
  inviteToken: string;
  createdAt: string;
  acceptedAt?: string | null;
}

export interface UseSharingSettingsProps {
  uid: string | undefined;
  language: string;
  isHebrew: boolean;
  ownerEmail?: string | null;
}

export function useSharingSettings({ uid, language, isHebrew, ownerEmail }: UseSharingSettingsProps) {
  const [sharedAccessList, setSharedAccessList] = useState<SharedAccessEntry[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<SharedAccessRole>('manager');
  const [isLoadingSharing, setIsLoadingSharing] = useState(false);
  const [isSavingSharing, setIsSavingSharing] = useState(false);
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    setIsLoadingSharing(true);
    fetch('/api/sharing', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { sharedAccess?: SharedAccessEntry[] }) => setSharedAccessList(d.sharedAccess ?? []))
      .catch((err) => console.error('Failed to load shared access list:', err))
      .finally(() => setIsLoadingSharing(false));
  }, [uid]);

  const showSharingMessage = (message: string) => {
    setSharingMessage(message);
    setTimeout(() => setSharingMessage(null), 4000);
  };

  const buildInvitationEmail = (
    lang: string,
    ownerEmailAddr: string,
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
      he: { subject: `הוזמנת ל-BScale AI`, title: 'הוזמנת ל-BScale AI', greeting: 'שלום,', body: `<strong>${ownerEmailAddr}</strong> הזמין אותך להצטרף ל-BScale AI בתפקיד <strong>${roleLabel}</strong>.`, instructions: `כדי להצטרף, לחץ על הכפתור למטה. תצטרך להתחבר עם האימייל <strong>${invitedEmail}</strong>.`, button: 'אישור הצטרפות', note: 'לאחר האישור תוכל לגשת לסביבה המשותפת.', footer: 'אם לא ציפית להזמנה זו, ניתן להתעלם ממייל זה בבטחה.' },
      en: { subject: `You've been invited to BScale AI`, title: "You've been invited to BScale AI", greeting: 'Hello,', body: `<strong>${ownerEmailAddr}</strong> has invited you to join BScale AI as a <strong>${roleLabel}</strong>.`, instructions: `To join, click the button below. You'll need to sign in with <strong>${invitedEmail}</strong>.`, button: 'Accept Invitation', note: "After accepting, you'll have access to the shared workspace.", footer: "If you didn't expect this invitation, you can safely ignore this email." },
    };
    const tx = texts[lang] || texts.en;
    const dir = lang === 'he' ? 'rtl' : 'ltr';
    const html = `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${tx.subject}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,sans-serif;direction:${dir};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 20px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:28px;">BScale AI</h1></td></tr>
<tr><td style="padding:40px;">
<h2 style="color:#1a1a2e;font-size:22px;margin:0 0 16px;">${tx.title}</h2>
<p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 12px;">${tx.body}</p>
<p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 32px;">${tx.instructions}</p>
<table width="100%"><tr><td align="center">
<a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 48px;border-radius:8px;">${tx.button}</a>
</td></tr></table>
<p style="color:#718096;font-size:13px;margin:28px 0 0;text-align:center;">${tx.note}</p>
</td></tr>
<tr><td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #e8ecef;">
<p style="color:#a0aec0;font-size:12px;margin:0;text-align:center;">${tx.footer}</p>
</td></tr></table></td></tr></table></body></html>`;
    return { subject: tx.subject, html };
  };

  const handleAddSharedAccess = async () => {
    if (!uid) return;
    setIsSavingSharing(true);
    try {
      const res = await fetch('/api/sharing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: shareEmail.trim().toLowerCase(), role: shareRole }),
      });
      const d = (await res.json()) as { success?: boolean; inviteToken?: string; error?: string };
      if (!res.ok) throw new Error(d.error || 'Failed');

      const inviteToken = d.inviteToken ?? '';
      await fetch('/api/invitations/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken, invitedEmail: shareEmail.trim().toLowerCase(), role: shareRole }),
      }).catch((err) => console.error('[Settings] Failed to mirror invitation:', err));

      const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bscale.co.il';
      const acceptUrl = `${appOrigin}?accept_invite=${inviteToken}`;
      const { subject, html } = buildInvitationEmail(language, ownerEmail || '', shareEmail.trim().toLowerCase(), shareRole, acceptUrl);

      let emailSent = false;
      try {
        const emailRes = await fetch('/api/connections/google/gmail-send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ to: shareEmail.trim(), subject, body: html }),
        });
        emailSent = emailRes.ok;
      } catch { emailSent = false; }

      const listRes = await fetch('/api/sharing', { credentials: 'include' });
      const listData = (await listRes.json()) as { sharedAccess?: SharedAccessEntry[] };
      setSharedAccessList(listData.sharedAccess ?? []);
      setShareEmail('');

      if (emailSent) {
        showSharingMessage(isHebrew ? 'הרשאת השיתוף נשמרה ומייל הזמנה נשלח.' : 'Sharing permission saved and invitation email sent.');
      } else {
        showSharingMessage(
          isHebrew
            ? 'המשתמש נוסף, אך שליחת המייל נכשלה. שלח את קישור ההזמנה ידנית: ' + acceptUrl
            : 'User added, but email delivery failed. Share this invite link manually: ' + acceptUrl
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg === 'Cannot share with yourself') {
        showSharingMessage(isHebrew ? 'לא ניתן לשתף עם עצמך.' : 'You cannot share with yourself.');
      } else {
        showSharingMessage(isHebrew ? 'לא הצלחנו לשמור הרשאת שיתוף.' : 'Could not save sharing permission.');
      }
    } finally {
      setIsSavingSharing(false);
    }
  };

  const handleRemoveSharedAccess = async (email: string) => {
    if (!uid) return;
    setIsSavingSharing(true);
    try {
      await fetch('/api/sharing', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const listRes = await fetch('/api/sharing', { credentials: 'include' });
      const listData = (await listRes.json()) as { sharedAccess?: SharedAccessEntry[] };
      setSharedAccessList(listData.sharedAccess ?? []);
      showSharingMessage(isHebrew ? 'הרשאת השיתוף הוסרה.' : 'Sharing permission removed.');
    } catch (err) {
      console.error('Failed to remove shared access:', err);
      showSharingMessage(isHebrew ? 'מחיקת הרשאת השיתוף נכשלה.' : 'Failed to remove sharing permission.');
    } finally {
      setIsSavingSharing(false);
    }
  };

  return {
    sharedAccessList,
    invitations: sharedAccessList,
    shareEmail, setShareEmail,
    shareRole, setShareRole,
    isLoadingSharing,
    isSavingSharing,
    sharingMessage,
    handleAddSharedAccess,
    handleRemoveSharedAccess,
  };
}
