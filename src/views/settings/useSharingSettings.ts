import { useState, useEffect } from 'react';
import {
  auth,
  getUserSharedAccess,
  removeUserSharedAccess,
  upsertUserSharedAccess,
  getOwnerInvitations,
  type SharedAccessEntry,
  type SharedAccessRole,
  type InvitationDoc,
} from '../../lib/firebase';

export interface UseSharingSettingsProps {
  uid: string | undefined;
  language: string;
  isHebrew: boolean;
}

export function useSharingSettings({ uid, language, isHebrew }: UseSharingSettingsProps) {
  const [sharedAccessList, setSharedAccessList] = useState<SharedAccessEntry[]>([]);
  const [invitations, setInvitations] = useState<InvitationDoc[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<SharedAccessRole>('manager');
  const [isLoadingSharing, setIsLoadingSharing] = useState(false);
  const [isSavingSharing, setIsSavingSharing] = useState(false);
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    setIsLoadingSharing(true);
    getUserSharedAccess(uid)
      .then((entries) => setSharedAccessList(entries))
      .catch((err) => {
        console.error('Failed to load shared access list:', err);
      })
      .finally(() => setIsLoadingSharing(false));
    getOwnerInvitations(uid).then(setInvitations).catch((err) => {
      console.error('[Settings] Failed to load invitations:', err);
    });
  }, [uid]);

  const showSharingMessage = (message: string) => {
    setSharingMessage(message);
    setTimeout(() => setSharingMessage(null), 4000);
  };

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
    const currentUser = auth.currentUser;
    try {
      const { list: next, inviteToken } = await upsertUserSharedAccess(uid, shareEmail, shareRole, {
        uid,
        email: currentUser?.email,
      });
      setSharedAccessList(next);

      await fetch('/api/invitations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken, invitedEmail: shareEmail.trim().toLowerCase(), role: shareRole }),
      }).catch((err) => {
        console.error('[Settings] Failed to mirror invitation to managed layer:', err);
      });

      getOwnerInvitations(uid).then(setInvitations).catch((err) => {
        console.error('[Settings] Failed to load invitations:', err);
      });

      const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bscale.co.il';
      const acceptUrl = `${appOrigin}?accept_invite=${inviteToken}`;
      const ownerEmailAddr = currentUser?.email || '';
      const { subject, html } = buildInvitationEmail(language, ownerEmailAddr, shareEmail.trim().toLowerCase(), shareRole, acceptUrl);

      let emailSent = false;
      try {
        const emailRes = await fetch('/api/connections/google/gmail-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: shareEmail.trim(), subject, body: html }),
        });
        emailSent = emailRes.ok;
      } catch {
        emailSent = false;
      }

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
      console.error('Failed to add shared access:', err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg === 'Cannot share with yourself') {
        showSharingMessage(isHebrew ? 'לא ניתן לשתף עם עצמך.' : 'You cannot share with yourself.');
      } else if (errMsg === 'Invalid email') {
        showSharingMessage(isHebrew ? 'כתובת האימייל שגויה.' : 'Invalid email address.');
      } else {
        showSharingMessage(isHebrew ? 'לא הצלחנו לשמור הרשאת שיתוף. בדוק את האימייל ונסה שוב.' : 'Could not save sharing permission. Check the email and try again.');
      }
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
      getOwnerInvitations(uid).then(setInvitations).catch((err) => {
        console.error('[Settings] Failed to load invitations:', err);
      });
      showSharingMessage(isHebrew ? 'הרשאת השיתוף הוסרה.' : 'Sharing permission removed.');
    } catch (err) {
      console.error('Failed to remove shared access:', err);
      showSharingMessage(isHebrew ? 'מחיקת הרשאת השיתוף נכשלה. נסה שוב.' : 'Failed to remove sharing permission. Please try again.');
    } finally {
      setIsSavingSharing(false);
    }
  };

  return {
    sharedAccessList,
    invitations,
    shareEmail, setShareEmail,
    shareRole, setShareRole,
    isLoadingSharing,
    isSavingSharing,
    sharingMessage,
    handleAddSharedAccess,
    handleRemoveSharedAccess,
  };
}
