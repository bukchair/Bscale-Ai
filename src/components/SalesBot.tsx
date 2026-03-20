"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useLanguage, type Language } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';
import { ADMIN_SALES_EMAIL, createPublicSalesLead } from '../lib/firebase';
import { trackEvent } from '../lib/tracking';

type ChatMessage = {
  id: string;
  from: 'bot' | 'user';
  text: string;
};

type QuickAction = 'leads' | 'sales' | 'support' | 'roas' | 'analysis' | 'leadForm';

type NeedsFormState = {
  name: string;
  phone: string;
  email: string;
  businessType: string;
  mainGoal: string;
  monthlyBudget: string;
  timeline: string;
};

type BotCopy = {
  title: string;
  greeting: string;
  chatPlaceholder: string;
  send: string;
  quickLeads: string;
  quickSales: string;
  quickSupport: string;
  quickRoas: string;
  quickAnalysis: string;
  quickLeadForm: string;
  cta: string;
  needAnalysisTitle: string;
  needAnalysisHint: string;
  name: string;
  phone: string;
  email: string;
  businessType: string;
  mainGoal: string;
  monthlyBudget: string;
  timeline: string;
  submitAnalysis: string;
  saving: string;
  validationContact: string;
  validationNeed: string;
  saveError: string;
  success: string;
  quickLogin: string;
  quickRegister: string;
  openAria: string;
  respLeads: string;
  respSales: string;
  respSupport: string;
  respRoas: string;
  respDefault: string;
  analysisPrompt: string;
  leadPrompt: string;
  liveNow: string;
};

const COPY: Record<Language, BotCopy> = {
  he: {
    title: 'צ׳אט מכירות BScale',
    greeting: 'היי, אני כאן כדי לעזור לך לסגור יותר עסקאות. ספר לי מה היעד העסקי הקרוב שלך.',
    chatPlaceholder: 'כתוב מה אתה רוצה לשפר בפרסום או במכירות...',
    send: 'שלח',
    quickLeads: 'יותר לידים',
    quickSales: 'מכירה',
    quickSupport: 'תמיכה טכנית',
    quickRoas: 'שיפור ROAS',
    quickAnalysis: 'ניתוח צרכים',
    quickLeadForm: 'השלמת הרשמת ליד',
    cta: 'אם זה רלוונטי, מלא את ניתוח הצרכים ונבנה לך תוכנית פעולה מותאמת.',
    needAnalysisTitle: 'ניתוח צרכים קצר',
    needAnalysisHint: 'מילוי קצר של הפרטים עוזר לנו להחזיר לך הצעה מדויקת.',
    name: 'שם מלא',
    phone: 'טלפון',
    email: 'אימייל',
    businessType: 'תחום פעילות',
    mainGoal: 'מטרה עיקרית ל 90 יום',
    monthlyBudget: 'תקציב חודשי משוער',
    timeline: 'תוך כמה זמן רוצים לראות תוצאה',
    submitAnalysis: 'שליחת ניתוח ופרטים',
    saving: 'שומר...',
    validationContact: 'צריך שם מלא וטלפון או אימייל.',
    validationNeed: 'צריך למלא תחום פעילות ומטרה עיקרית.',
    saveError: 'לא הצלחנו לשמור כרגע. נסה שוב בעוד רגע.',
    success: 'מעולה. ניתוח הצרכים והפרטים נשמרו. נחזור אליך עם כיוון מכירתי ברור.',
    quickLogin: 'כניסה מהירה למערכת',
    quickRegister: 'פתיחת חשבון חדש',
    openAria: 'פתח צאט מכירות',
    respLeads: 'כדי להגדיל לידים צריך לחדד הצעה, קהל ומסר. נבנה עבורך מהלך פשוט שמייצר פניות איכותיות.',
    respSales: 'כדי להגדיל מכירות צריך חיבור בין קמפיינים, משפך וקריאייטיב. אפשר לשפר תוצאות מהר כשפועלים לפי נתונים.',
    respSupport: 'מעולה, תמיכה טכנית כאן לעזור. כתוב מה לא עובד, באיזה מסך, ומה השגיאה המדויקת כדי שנפתור מהר.',
    respRoas: 'שיפור ROAS מתחיל בהפחתת בזבוז תקציב והגדלת השקעה בקמפיינים מנצחים. נזהה יחד מה לעצור ומה להגדיל.',
    respDefault: 'נשמע טוב. כדי לתת המלצה אמיתית, אני צריך להבין מה אתה מוכר ומה היעד הקרוב שלך.',
    analysisPrompt: 'מעולה. מלא את ניתוח הצרכים ונעבור להצעה מדויקת.',
    leadPrompt: 'מצוין. נשלים עכשיו הרשמת ליד קצרה כדי שנחזור אליך עם מענה מדויק ומהיר.',
    liveNow: 'צאט לייב',
  },
  en: {
    title: 'BScale Sales Chat',
    greeting: 'Hi, I am here to help you close more deals. Tell me your next business goal.',
    chatPlaceholder: 'Write what you want to improve in sales or marketing...',
    send: 'Send',
    quickLeads: 'More leads',
    quickSales: 'Sales',
    quickSupport: 'Technical support',
    quickRoas: 'Improve ROAS',
    quickAnalysis: 'Needs analysis',
    quickLeadForm: 'Complete lead signup',
    cta: 'If relevant, fill the short needs analysis and we will build an action plan.',
    needAnalysisTitle: 'Quick needs analysis',
    needAnalysisHint: 'A short form helps us return with a focused offer.',
    name: 'Full name',
    phone: 'Phone',
    email: 'Email',
    businessType: 'Business type',
    mainGoal: 'Main 90 day goal',
    monthlyBudget: 'Estimated monthly budget',
    timeline: 'When do you need first results',
    submitAnalysis: 'Send analysis and details',
    saving: 'Saving...',
    validationContact: 'Full name and phone or email are required.',
    validationNeed: 'Business type and main goal are required.',
    saveError: 'Could not save right now. Please try again in a moment.',
    success: 'Great. Your needs analysis and contact were saved. We will return with a clear sales plan.',
    quickLogin: 'Quick login to platform',
    quickRegister: 'Create account',
    openAria: 'Open sales chat',
    respLeads: 'To increase leads, we need a sharper offer, audience and message. We can build a simple lead flow fast.',
    respSales: 'To increase sales, we align campaigns, funnel and creative. Data driven steps usually create quick wins.',
    respSupport: 'Great, technical support is here to help. Share what is not working, on which screen, and the exact error.',
    respRoas: 'Improving ROAS starts with cutting waste and scaling winning campaigns. We can identify both quickly.',
    respDefault: 'Sounds good. To give a real recommendation, I need to understand what you sell and your immediate goal.',
    analysisPrompt: 'Great. Fill the needs analysis and we will move to a focused offer.',
    leadPrompt: 'Great. Let us complete a short lead signup so we can get back to you quickly with a focused plan.',
    liveNow: 'Live chat',
  },
  ru: {
    title: 'BScale Sales Chat',
    greeting: 'Привет. Помогу вам получать больше продаж. Напишите ближайшую бизнес цель.',
    chatPlaceholder: 'Напишите, что хотите улучшить в маркетинге или продажах...',
    send: 'Отправить',
    quickLeads: 'Больше лидов',
    quickSales: 'Продажи',
    quickSupport: 'Техподдержка',
    quickRoas: 'Улучшить ROAS',
    quickAnalysis: 'Анализ потребностей',
    quickLeadForm: 'Завершить регистрацию лида',
    cta: 'Заполните короткий анализ и мы подготовим план действий.',
    needAnalysisTitle: 'Короткий анализ потребностей',
    needAnalysisHint: 'Короткая форма помогает дать точное предложение.',
    name: 'Полное имя',
    phone: 'Телефон',
    email: 'Email',
    businessType: 'Сфера бизнеса',
    mainGoal: 'Главная цель на 90 дней',
    monthlyBudget: 'Бюджет в месяц',
    timeline: 'Когда нужен первый результат',
    submitAnalysis: 'Отправить анализ и контакты',
    saving: 'Сохраняем...',
    validationContact: 'Нужны имя и телефон или email.',
    validationNeed: 'Нужно заполнить сферу бизнеса и главную цель.',
    saveError: 'Сейчас не получилось сохранить. Попробуйте еще раз.',
    success: 'Отлично. Анализ и контакты сохранены. Вернемся с четким планом роста.',
    quickLogin: 'Быстрый вход',
    quickRegister: 'Открыть новый аккаунт',
    openAria: 'Открыть чат продаж',
    respLeads: 'Для роста лидов нужно уточнить оффер, аудиторию и сообщение. Это дает быстрый эффект.',
    respSales: 'Для роста продаж важно связать кампании, воронку и креатив в одну систему.',
    respSupport: 'Отлично, техническая поддержка на связи. Опишите, что не работает, на каком экране и какой текст ошибки.',
    respRoas: 'Рост ROAS начинается со снижения потерь и усиления эффективных кампаний.',
    respDefault: 'Хорошо. Чтобы дать точную рекомендацию, нужно понять продукт и ближайшую цель.',
    analysisPrompt: 'Отлично. Заполните анализ потребностей и перейдем к точному предложению.',
    leadPrompt: 'Отлично. Заполним короткую форму лида и мы быстро вернемся с точным решением.',
    liveNow: 'Живой чат',
  },
  pt: {
    title: 'BScale Sales Chat',
    greeting: 'Oi. Vou te ajudar a vender mais. Me diga sua meta de negócio para agora.',
    chatPlaceholder: 'Escreva o que você quer melhorar em marketing ou vendas...',
    send: 'Enviar',
    quickLeads: 'Mais leads',
    quickSales: 'Vendas',
    quickSupport: 'Suporte tecnico',
    quickRoas: 'Melhorar ROAS',
    quickAnalysis: 'Analise de necessidades',
    quickLeadForm: 'Concluir cadastro de lead',
    cta: 'Preencha a analise curta e montamos um plano de ação.',
    needAnalysisTitle: 'Analise rapida de necessidades',
    needAnalysisHint: 'Uma forma curta ajuda a entregar proposta mais precisa.',
    name: 'Nome completo',
    phone: 'Telefone',
    email: 'Email',
    businessType: 'Tipo de negocio',
    mainGoal: 'Meta principal para 90 dias',
    monthlyBudget: 'Orçamento mensal estimado',
    timeline: 'Em quanto tempo precisa de resultado',
    submitAnalysis: 'Enviar analise e contato',
    saving: 'Salvando...',
    validationContact: 'Nome completo e telefone ou email são obrigatórios.',
    validationNeed: 'Tipo de negocio e meta principal são obrigatórios.',
    saveError: 'Nao foi possivel salvar agora. Tente novamente.',
    success: 'Perfeito. Analise e contato salvos. Vamos retornar com plano comercial claro.',
    quickLogin: 'Login rapido na plataforma',
    quickRegister: 'Criar conta',
    openAria: 'Abrir chat de vendas',
    respLeads: 'Para gerar mais leads precisamos ajustar oferta, publico e mensagem.',
    respSales: 'Para vender mais, alinhamos campanhas, funil e criativo com foco em conversão.',
    respSupport: 'Perfeito, suporte tecnico aqui. Escreva o que nao funciona, em qual tela, e a mensagem de erro.',
    respRoas: 'Melhorar ROAS começa com menos desperdicio e mais verba no que performa.',
    respDefault: 'Perfeito. Para recomendação real, preciso entender seu produto e sua meta imediata.',
    analysisPrompt: 'Ótimo. Preencha a analise de necessidades para avançarmos com proposta objetiva.',
    leadPrompt: 'Ótimo. Vamos concluir um cadastro curto de lead para retornarmos rápido com um plano objetivo.',
    liveNow: 'Chat ao vivo',
  },
  fr: {
    title: 'BScale Sales Chat',
    greeting: 'Bonjour. Je suis la pour vous aider a vendre plus. Donnez moi votre objectif business actuel.',
    chatPlaceholder: 'Ecrivez ce que vous voulez améliorer en marketing ou ventes...',
    send: 'Envoyer',
    quickLeads: 'Plus de leads',
    quickSales: 'Ventes',
    quickSupport: 'Support technique',
    quickRoas: 'Améliorer le ROAS',
    quickAnalysis: 'Analyse des besoins',
    quickLeadForm: 'Finaliser l inscription du lead',
    cta: 'Remplissez la courte analyse et nous construirons un plan d action.',
    needAnalysisTitle: 'Analyse rapide des besoins',
    needAnalysisHint: 'Un court formulaire permet de revenir avec une offre ciblée.',
    name: 'Nom complet',
    phone: 'Téléphone',
    email: 'Email',
    businessType: 'Type d activité',
    mainGoal: 'Objectif principal sur 90 jours',
    monthlyBudget: 'Budget mensuel estimé',
    timeline: 'Delai souhaité pour les premiers résultats',
    submitAnalysis: 'Envoyer analyse et contact',
    saving: 'Enregistrement...',
    validationContact: 'Nom complet et téléphone ou email obligatoires.',
    validationNeed: 'Type d activité et objectif principal obligatoires.',
    saveError: 'Impossible d enregistrer pour le moment. Réessayez dans un instant.',
    success: 'Parfait. Analyse et contact enregistrés. Nous revenons avec un plan commercial clair.',
    quickLogin: 'Connexion rapide à la plateforme',
    quickRegister: 'Créer un compte',
    openAria: 'Ouvrir le chat commercial',
    respLeads: 'Pour obtenir plus de leads, il faut clarifier l offre, l audience et le message.',
    respSales: 'Pour vendre plus, il faut aligner campagnes, tunnel et créatifs sur un objectif conversion.',
    respSupport: 'Parfait, le support technique est la. Dites ce qui ne fonctionne pas, sur quel écran, et le message d erreur.',
    respRoas: 'Améliorer le ROAS commence par réduire le gaspillage et renforcer les campagnes gagnantes.',
    respDefault: 'Très bien. Pour une recommandation utile, je dois comprendre votre produit et votre objectif immédiat.',
    analysisPrompt: 'Parfait. Remplissez l analyse des besoins et nous passons a une offre ciblée.',
    leadPrompt: 'Parfait. Finalisons un court formulaire de lead et nous revenons vite avec un plan ciblé.',
    liveNow: 'Chat en direct',
  },
};

const INITIAL_FORM: NeedsFormState = {
  name: '',
  phone: '',
  email: '',
  businessType: '',
  mainGoal: '',
  monthlyBudget: '',
  timeline: '',
};

export function SalesBot() {
  const { language, dir } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [form, setForm] = useState<NeedsFormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const botRootRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutsRef = useRef<number[]>([]);

  const quickActions = useMemo(
    () => [
      { id: 'leads' as QuickAction, label: copy.quickLeads },
      { id: 'sales' as QuickAction, label: copy.quickSales },
      { id: 'support' as QuickAction, label: copy.quickSupport },
      { id: 'roas' as QuickAction, label: copy.quickRoas },
      { id: 'analysis' as QuickAction, label: copy.quickAnalysis },
    ],
    [copy]
  );

  useEffect(() => {
    setMessages([{ id: 'greeting', from: 'bot', text: copy.greeting }]);
  }, [copy.greeting]);

  useEffect(() => {
    return () => {
      typingTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      typingTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isBotTyping, isOpen, showAnalysis, submitError]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (botRootRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const appendMessage = (from: 'bot' | 'user', text: string) => {
    setMessages((prev) => [...prev, { id: `${from}-${Date.now()}`, from, text }]);
  };

  const appendBotMessageWithTyping = (text: string, delayMs = 800) => {
    setIsBotTyping(true);
    const timeoutId = window.setTimeout(() => {
      appendMessage('bot', text);
      typingTimeoutsRef.current = typingTimeoutsRef.current.filter((id) => id !== timeoutId);
      if (typingTimeoutsRef.current.length === 0) {
        setIsBotTyping(false);
      }
    }, delayMs);
    typingTimeoutsRef.current.push(timeoutId);
  };

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\u0400-\u04ff\u0590-\u05ff\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const getSalesResponse = (raw: string) => {
    const q = normalize(raw);
    if (
      q.includes('lead') ||
      q.includes('ליד') ||
      q.includes('потенц') ||
      q.includes('leads')
    ) {
      return `${copy.respLeads}\n\n${copy.cta}`;
    }
    if (
      q.includes('sale') ||
      q.includes('מכירות') ||
      q.includes('מכירה') ||
      q.includes('продаж') ||
      q.includes('vendas')
    ) {
      return `${copy.respSales}\n\n${copy.cta}`;
    }
    if (
      q.includes('support') ||
      q.includes('תמיכה') ||
      q.includes('תקלה') ||
      q.includes('error') ||
      q.includes('שגיאה') ||
      q.includes('тех') ||
      q.includes('suporte') ||
      q.includes('support technique')
    ) {
      return `${copy.respSupport}\n\n${copy.cta}`;
    }
    if (q.includes('roas') || q.includes('roi') || q.includes('רווח')) {
      return `${copy.respRoas}\n\n${copy.cta}`;
    }
    return `${copy.respDefault}\n\n${copy.cta}`;
  };

  const handleQuickAction = (action: QuickAction, label: string) => {
    appendMessage('user', label);
    setSubmitError(null);
    trackEvent('bscale_chat_quick_action', {
      action,
      language,
      page_path: window.location.pathname,
    });

    if (action === 'analysis' || action === 'leadForm') {
      appendBotMessageWithTyping(action === 'leadForm' ? copy.leadPrompt : copy.analysisPrompt, 700);
      setShowAnalysis(true);
      return;
    }

    const response =
      action === 'leads'
        ? copy.respLeads
        : action === 'sales'
          ? copy.respSales
          : action === 'support'
            ? copy.respSupport
            : copy.respRoas;

    appendBotMessageWithTyping(`${response}\n\n${copy.cta}`);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    trackEvent('bscale_chat_message_sent', {
      message_length: text.length,
      language,
      page_path: window.location.pathname,
    });
    appendMessage('user', text);
    setInput('');
    setSubmitError(null);
    appendBotMessageWithTyping(getSalesResponse(text));
  };

  const handleSubmitAnalysis = async () => {
    const hasContact = form.phone.trim() || form.email.trim();
    if (!form.name.trim() || !hasContact) {
      setSubmitError(copy.validationContact);
      return;
    }
    if (!form.businessType.trim() || !form.mainGoal.trim()) {
      setSubmitError(copy.validationNeed);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const analysisMessage = [
        'Lead from sales chat',
        `Business type: ${form.businessType}`,
        `Main goal: ${form.mainGoal}`,
        `Monthly budget: ${form.monthlyBudget || '-'}`,
        `Timeline: ${form.timeline || '-'}`,
      ].join('\n');

      await createPublicSalesLead({
        name: form.name,
        phone: form.phone,
        email: form.email,
        sourcePath: window.location.pathname,
        message: analysisMessage,
        assignedAdminEmail: ADMIN_SALES_EMAIL,
      });
      trackEvent('bscale_lead_submit', {
        source: 'sales_bot',
        form_type: 'needs_analysis',
        has_email: Boolean(form.email.trim()),
        has_phone: Boolean(form.phone.trim()),
        language,
      });

      appendBotMessageWithTyping(copy.success, 500);
      setForm(INITIAL_FORM);
      setShowAnalysis(false);
    } catch (error) {
      console.error('Failed to save sales analysis lead:', error);
      setSubmitError(copy.saveError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={botRootRef}
      data-sales-bot-root="true"
      className={cn('fixed z-[130]', dir === 'rtl' ? 'left-4 sm:left-6' : 'right-4 sm:right-6', 'bottom-4 sm:bottom-6')}
      dir={dir}
    >
      {isOpen && (
        <div className="mb-3 w-[min(360px,calc(100vw-1rem))] bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <p className="text-sm font-bold">{copy.title}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                {copy.liveNow}
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-white/15 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[52vh] sm:max-h-[300px] overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-[#0b0b0b]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[92%] whitespace-pre-line',
                  message.from === 'bot'
                    ? 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-100'
                    : 'bg-indigo-600 text-white ms-auto'
                )}
              >
                {message.text}
              </div>
            ))}
            {isBotTyping && (
              <div className="rounded-xl px-3 py-2 text-sm max-w-[92%] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:300ms]" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] space-y-3">
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.id, action.label)}
                  className="px-2.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleQuickAction('leadForm', copy.quickLeadForm)}
              className="w-full rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 py-2 text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              {copy.quickLeadForm}
            </button>

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSend();
                }}
                placeholder={copy.chatPlaceholder}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleSend}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                {copy.send}
              </button>
            </div>

            {showAnalysis && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
                <div>
                  <p className="text-xs font-bold text-indigo-900">{copy.needAnalysisTitle}</p>
                  <p className="text-[11px] text-indigo-700">{copy.needAnalysisHint}</p>
                </div>

                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={copy.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder={copy.phone}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                  <input
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder={copy.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <input
                  value={form.businessType}
                  onChange={(event) => setForm((prev) => ({ ...prev, businessType: event.target.value }))}
                  placeholder={copy.businessType}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
                <input
                  value={form.mainGoal}
                  onChange={(event) => setForm((prev) => ({ ...prev, mainGoal: event.target.value }))}
                  placeholder={copy.mainGoal}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={form.monthlyBudget}
                    onChange={(event) => setForm((prev) => ({ ...prev, monthlyBudget: event.target.value }))}
                    placeholder={copy.monthlyBudget}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                  <input
                    value={form.timeline}
                    onChange={(event) => setForm((prev) => ({ ...prev, timeline: event.target.value }))}
                    placeholder={copy.timeline}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
                {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                <button
                  onClick={handleSubmitAnalysis}
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                >
                  {isSubmitting ? copy.saving : copy.submitAnalysis}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <a href="/auth" className="text-xs text-indigo-600 font-bold hover:underline">
                {copy.quickLogin}
              </a>
              <a href="/auth?mode=register" className="text-xs text-indigo-600 font-bold hover:underline">
                {copy.quickRegister}
              </a>
            </div>
            <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI Sales
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            if (next) {
              trackEvent('bscale_chat_open', {
                source: 'floating_button',
                language,
                page_path: window.location.pathname,
              });
            } else {
              trackEvent('bscale_chat_close', {
                source: 'floating_button',
                language,
                page_path: window.location.pathname,
              });
            }
            return next;
          });
        }}
        className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 transition-colors flex items-center justify-center"
        aria-label={copy.openAria}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
