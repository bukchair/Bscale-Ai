import React, { useEffect, useMemo, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

type ChatMessage = {
  id: string;
  from: 'bot' | 'user';
  text: string;
};

type QuickIntent = 'pricing' | 'demo' | 'integrations' | 'roi' | 'lead';

interface LeadFormState {
  name: string;
  email: string;
  phone: string;
  website: string;
}

const SALES_EMAIL = 'sales@bscale.co.il';

export function SalesBot() {
  const { language, dir } = useLanguage();
  const isHebrew = language === 'he';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [collectingLead, setCollectingLead] = useState(false);
  const [lead, setLead] = useState<LeadFormState>({ name: '', email: '', phone: '', website: '' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasPrompted, setHasPrompted] = useState(false);

  const botGreeting = isHebrew
    ? 'היי! אני בוט המכירות של BScale. רוצה הצעת מחיר, הדגמה או התאמה לעסק שלך?'
    : 'Hi! I am the BScale sales bot. Need pricing, a demo, or a fit check for your business?';

  const quickReplies = useMemo(
    () => [
      { id: 'pricing' as QuickIntent, label: isHebrew ? 'מחירים' : 'Pricing' },
      { id: 'demo' as QuickIntent, label: isHebrew ? 'לקבוע דמו' : 'Book a demo' },
      { id: 'integrations' as QuickIntent, label: isHebrew ? 'חיבורים נתמכים' : 'Supported integrations' },
      { id: 'roi' as QuickIntent, label: isHebrew ? 'איך משפרים רווחיות?' : 'How do you improve ROI?' },
      { id: 'lead' as QuickIntent, label: isHebrew ? 'השארת פרטים' : 'Leave details' },
    ],
    [isHebrew]
  );

  useEffect(() => {
    setMessages([{ id: 'greeting', from: 'bot', text: botGreeting }]);
  }, [botGreeting]);

  useEffect(() => {
    if (hasPrompted) return;
    const timeout = window.setTimeout(() => {
      setIsOpen(true);
      setHasPrompted(true);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [hasPrompted]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleQuickIntent = (intent: QuickIntent, label: string) => {
    appendMessage({ id: `user-${intent}-${Date.now()}`, from: 'user', text: label });
    setSubmitError(null);

    if (intent === 'lead') {
      setCollectingLead(true);
      appendMessage({
        id: `bot-${intent}-${Date.now()}`,
        from: 'bot',
        text: isHebrew
          ? 'מעולה. מלא/י שם + אימייל/טלפון ואחזור אליך עם תוכנית מותאמת.'
          : 'Great. Leave your name + email/phone and I will get back with a tailored plan.',
      });
      return;
    }

    setCollectingLead(false);
    const responses: Record<Exclude<QuickIntent, 'lead'>, string> = {
      pricing: isHebrew
        ? 'המחיר משתנה לפי היקף ערוצים והיקף אוטומציות. אפשר להתחיל מחבילת בסיס ולהתרחב לפי תוצאות.'
        : 'Pricing depends on channels and automation scope. You can start with a base plan and scale by results.',
      demo: isHebrew
        ? 'מצוין — אפשר לקבוע דמו קצר של 20 דקות ולהבין איפה הכי מהר משפרים ביצועים.'
        : 'Great — we can book a 20-minute demo and identify the fastest performance wins.',
      integrations: isHebrew
        ? 'המערכת מתחברת ל-Google, Meta, TikTok ו-WooCommerce ומאחדת הכול למסך אחד.'
        : 'The platform connects Google, Meta, TikTok, and WooCommerce in one unified workspace.',
      roi: isHebrew
        ? 'אנחנו ממקדים תקציב לקמפיינים עם ROAS גבוה, מצמצמים בזבוז חיפוש, ומשפרים המרות דרך SEO ואוטומציות.'
        : 'We shift budget to high-ROAS campaigns, reduce wasted search spend, and improve conversion via SEO and automations.',
    };

    appendMessage({
      id: `bot-${intent}-${Date.now()}`,
      from: 'bot',
      text: responses[intent],
    });
  };

  const handleLeadSubmit = () => {
    const hasContact = lead.email.trim() || lead.phone.trim();
    if (!lead.name.trim() || !hasContact) {
      setSubmitError(
        isHebrew
          ? 'נא למלא שם + אימייל או טלפון.'
          : 'Please provide a name + email or phone.'
      );
      return;
    }

    const summary = [
      `Name: ${lead.name}`,
      `Email: ${lead.email || '-'}`,
      `Phone: ${lead.phone || '-'}`,
      `Website: ${lead.website || '-'}`,
      `Source: Sales bot (${window.location.pathname})`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    const subject = encodeURIComponent(`New sales lead - ${lead.name}`);
    const body = encodeURIComponent(summary);
    window.open(`mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`, '_blank');

    appendMessage({
      id: `bot-lead-success-${Date.now()}`,
      from: 'bot',
      text: isHebrew
        ? 'קיבלתי 🙌 פתחתי עבורך מייל עם הפרטים לשליחה מהירה לצוות המכירות.'
        : 'Got it 🙌 I opened an email draft with your details for quick handoff to sales.',
    });

    setLead({ name: '', email: '', phone: '', website: '' });
    setCollectingLead(false);
    setSubmitError(null);
  };

  return (
    <div className={cn('fixed z-50', dir === 'rtl' ? 'left-4 sm:left-6' : 'right-4 sm:right-6', 'bottom-4 sm:bottom-6')} dir={dir}>
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[360px] bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <p className="text-sm font-bold">{isHebrew ? 'בוט מכירות BScale' : 'BScale Sales Bot'}</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-white/15 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-[#0b0b0b]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[90%]',
                  message.from === 'bot'
                    ? 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-100'
                    : 'bg-indigo-600 text-white ms-auto'
                )}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] space-y-2">
            {!collectingLead && (
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((reply) => (
                  <button
                    key={reply.id}
                    onClick={() => handleQuickIntent(reply.id, reply.label)}
                    className="px-2.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    {reply.label}
                  </button>
                ))}
              </div>
            )}

            {collectingLead && (
              <div className="space-y-2">
                <input
                  value={lead.name}
                  onChange={(event) => setLead((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={isHebrew ? 'שם מלא' : 'Full name'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={lead.email}
                    onChange={(event) => setLead((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder={isHebrew ? 'אימייל' : 'Email'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    value={lead.phone}
                    onChange={(event) => setLead((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder={isHebrew ? 'טלפון' : 'Phone'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <input
                  value={lead.website}
                  onChange={(event) => setLead((prev) => ({ ...prev, website: event.target.value }))}
                  placeholder={isHebrew ? 'אתר / חנות (אופציונלי)' : 'Website / store (optional)'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  dir="ltr"
                />
                {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                <button
                  onClick={handleLeadSubmit}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isHebrew ? 'שליחת פרטים' : 'Send details'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <a href="/auth" className="text-xs text-indigo-600 font-bold hover:underline">
                {isHebrew ? 'כניסה מהירה למערכת' : 'Quick login to platform'}
              </a>
              <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {isHebrew ? 'AI Sales Assistant' : 'AI Sales Assistant'}
              </span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 transition-colors flex items-center justify-center"
        aria-label={isHebrew ? 'פתח בוט מכירות' : 'Open sales bot'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
