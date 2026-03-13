import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { SiteLegalNotice } from '../components/SiteLegalNotice';

type GuideSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type GuideContent = {
  title: string;
  subtitle: string;
  sections: GuideSection[];
  backHome: string;
};

const guideByLang: Record<string, GuideContent> = {
  he: {
    title: 'מדריך הפעלה למערכת BScale AI',
    subtitle:
      'איך לעבוד צעד‑אחד‑אחר‑השני עם הממשק - מחיבור הפלטפורמות ועד שימוש ב‑AI, בדוחות ובחיבורי WooCommerce.',
    sections: [
      {
        title: '1. כניסה למערכת ומבנה כללי',
        paragraphs: [
          'נכנסים ל‑bscale.co.il. מדף הבית ניתן להתחבר למערכת או לקרוא מדריכים נוספים. לאחר ההתחברות תועבר למסך סקירה כללית (Dashboard) בכתובת ‎/app.',
          'בצד המסך תראה תפריט צד עם כל העמודים: סקירה כללית, רווחיות, ניהול תקציב, קמפיינים, המלצות AI, SEO, מעבדת יצירה, מוצרים, חיבורים, משתמשים (לאדמין), הגדרות ומדיניות פרטיות.'
        ]
      },
      {
        title: '2. דרישות מערכת וחיבורים מומלצים',
        paragraphs: [
          'כדי למצות את מלוא היכולות של BScale AI, מומלץ לחבר את כל הפלטפורמות המרכזיות שבהן אתה משתמש לקמפיינים, אנליטיקה ומכירות.'
        ],
        bullets: [
          'Google Ads — למשיכת נתוני קמפיינים, תקציבים, המרות וביצועים.',
          'Google Search Console — לניתוח SEO, מיקומים אורגניים ומונחי חיפוש.',
          'Google Analytics 4 — לתנועת גולשים, התנהגות באתר ונתוני ריטנשן.',
          'Meta Ads (Facebook / Instagram) — לקמפיינים ברשתות החברתיות וסנכרון קהלים.',
          'TikTok Ads — לקמפיינים בווידאו וניתוח ביצועים מפלטפורמת TikTok.',
          'WooCommerce — לסנכרון מוצרים, הזמנות ודוחות רווחיות לחנויות וורדפרס.',
          'Shopify — לסנכרון מוצרים, מכירות ודוחות לחנויות Shopify.'
        ]
      },
      {
        title: '3. עמוד סקירה כללית - Dashboard',
        paragraphs: ['זהו העמוד הראשי שמרכז עבורך במבט אחד את מצב העסק לפי טווח התאריכים שבחרת.'],
        bullets: [
          'כרטיסים עליונים עם סך ההכנסות, הוצאות הקמפיינים, רווח נקי ו‑ROAS.',
          'גרף הכנסות מול הוצאות לאורך זמן, כולל נתוני WooCommerce מחוברים לסקייל תאריכים.',
          'תנועת גולשים בזמן אמת (GA4): משתמשים פעילים עכשיו וסך משתמשים בתקופה.',
          'נתוני SEO מ‑Search Console: קליקים, הופעות, מיקום ממוצע ו‑CTR.',
          'אם אחד החיבורים (Google, Meta, TikTok, WooCommerce) לא מחובר, המערכת מציגה נתוני דמו במקום מסך ריק.'
        ]
      },
      {
        title: '4. חיבורים משותפים ומשתמשים',
        paragraphs: [
          'בעמוד חיבורים אתה מגדיר פעם אחת את כל ההתחברויות: מנועי AI, Google, Meta, TikTok, WooCommerce ו‑Shopify. אחרי ההגדרה שאר העמודים משתמשים בנתונים האלו באופן אוטומטי.'
        ],
        bullets: [
          'מנועי AI (Gemini / OpenAI / Claude) נשמרים היום כרכיב גלובלי ברמת אדמין ומשותפים לכל המשתמשים באתר.',
          'משתמש אדמין בלבד יכול לערוך את המפתחות; משתמשים אחרים רואים רק סטטוס חיבור (מחובר/מנותק).',
          'קיים כפתור מיגרציה (אדמין בלבד) שמעביר חיבורים פרטיים ישנים למסמך חיבורים גלובלי.',
          'ניתן להגדיר גם פרטי WooCommerce, Meta, TikTok ו‑Shopify לפי המפתחות שהמערכת דורשת בכל פלטפורמה.'
        ]
      },
      {
        title: '5. מעבדת יצירה - Creative Lab',
        paragraphs: [
          'מעבדת היצירה מחוברת למנועי ה‑AI המשותפים ומאפשרת יצירת קריאייטיבים (תמונות וטקסטים) מתוך נתוני החנות שלך.'
        ],
        bullets: [
          'בחירת מוצר מחובר מ‑WooCommerce לצורך יצירה מדויקת לפי שם, תיאור ומחיר.',
          'המערכת מנקה את תיאורי המוצרים מ‑HTML ומשתמשת בהם כבסיס לפרומפט ל‑AI.',
          'בחירה אם ליצור תמונה, טקסט מודעה או תסריט וידאו - עם חוק ברור: ה‑AI לא משנה את המוצר בתמונה, רק את הרקע והאלמנטים מסביב.',
          'בעת יצירה מופיע טיימר זמן ריצה ודיווח על שלבי התהליך (קריאת מנועי AI, עיבוד תוצאה, הכנת תצוגה).',
          'ניתן לשמור את התוצאה למחשב ולהוריד קבצים, או להשתמש בהם בקמפיינים.'
        ]
      },
      {
        title: '6. קמפיינים והמלצות AI',
        paragraphs: ['המערכת מרכזת את הקמפיינים מכל הפלטפורמות המחוברות ונותנת אינדיקציה מה עובד טוב ומה צריך שיפור.'],
        bullets: [
          'עמוד קמפיינים: רשימת קמפיינים מ‑Google, Meta ו‑TikTok עם סטטוס, הוצאה, ROAS/CPA ועוד.',
          'עמוד המלצות AI: רשימת פעולות מומלצות כמו העלאת תקציב בקמפיין מנצח, עצירת מודעות מפסידות ושיפור קריאייטיבים.',
          'ניתן לסנן ולמיין כדי לזהות במה לטפל קודם, ולראות את סיבת ההמלצה.'
        ]
      },
      {
        title: '7. SEO, ניתוח חיפוש ו‑SEO למוצרים',
        paragraphs: [
          'חיבור ל‑Search Console ו‑GA4 מאפשר למערכת להציג ביצועי ביטויי מפתח, עמודים מובילים והזדמנויות לשיפור SEO.',
          'בעמוד המוצרים (WooCommerce) יש ממשק SEO עם AI שמייצר 3 הצעות מתיאור המוצר: כותרת SEO, תיאור מטא וטקסטים אלטרנטיביים לתמונות, בפורמט שמתאים ל‑Rank Math ו‑Yoast.'
        ]
      },
      {
        title: '8. מוצרים ונתונים פיננסיים מ‑WooCommerce',
        paragraphs: [
          'עמוד המוצרים מסנכרן את הקטלוג מהחנות שלך, ועמוד הרווחיות מושך את נתוני המכירות מ‑WooCommerce לפי טווח התאריכים שבחרת.'
        ],
        bullets: [
          'שם מוצר, SKU, מלאי, מחיר וקטגוריות - ישירות מתוך החנות.',
          'כפתור רענון מוצרים לעדכון התצוגה מול WooCommerce.',
          'דוחות רווחיות משלבים הכנסות WooCommerce עם הוצאות פרסום מפלטפורמות שונות.',
          'אם אין נתונים חיים בתקופה מסוימת - המערכת מציגה נתוני דמו כדי לשמור על גרפים מלאים.'
        ]
      },
      {
        title: '9. הגדרות, שפות, מטבע וזמן מערכת',
        paragraphs: [
          'בעמוד הגדרות ניתן לשלוט בהעדפות החשבון ובאופן התצוגה של כל המערכת.',
          'שינוי שפת המערכת (עברית, אנגלית, רוסית, פורטוגזית, צרפתית) משנה גם את שפת המדריך ואת מדיניות הפרטיות.',
          'ניתן לבחור מטבע מועדף (שקל, דולר, יורו) וכל המסכים הכספיים יתעדכנו בהתאם לסימן ולפורמט.',
          'שעת המערכת מתבססת על אזור זמן ירושלים לצד אזור הזמן המקומי של המשתמש, כך שדוחות ותאריכים מוצגים באופן עקבי.'
        ],
        bullets: [
          'ניהול פרטי פרופיל, לוגו ופרטי סוכנות.',
          'בחירת חבילה מתאימה, ניהול חיובים ואמצעי תשלום.',
          'אישור תנאי שימוש ומדיניות פרטיות לפני רכישה, בהתאם לדרישות הרגולציה.'
        ]
      }
    ],
    backHome: 'חזרה לדף הבית'
  },
  en: {
    title: 'BScale AI — Quick Start Guide',
    subtitle:
      'How to work step by step with the system — from connecting platforms to using AI, WooCommerce reports and the Creative Lab.',
    sections: [
      {
        title: '1. Login and Layout',
        paragraphs: [
          'Go to bscale.co.il and log in to your account. After login you land on the Overview dashboard at /app.',
          'The left sidebar contains all main pages: Overview, Profitability, Budget, Campaigns, AI Recommendations, SEO, Creative Lab, Products, Connections, Users (admin) and Settings & Privacy.'
        ]
      },
      {
        title: '2. System Requirements and Recommended Connections',
        paragraphs: [
          'To unlock the full power of BScale AI, we recommend connecting all key platforms you use for campaigns, analytics and ecommerce.'
        ],
        bullets: [
          'Google Ads — for pulling campaign performance, budgets and conversions.',
          'Google Search Console — for SEO analysis, organic rankings and search queries.',
          'Google Analytics 4 — for site traffic, behavior and retention.',
          'Meta Ads (Facebook / Instagram) — for social campaigns and audience sync.',
          'TikTok Ads — for video campaigns and performance metrics.',
          'WooCommerce — to sync products, orders and profitability reports for WordPress stores.',
          'Shopify — to sync products, sales and reports for Shopify stores.'
        ]
      },
      {
        title: '3. Overview Dashboard',
        paragraphs: ['The main screen gives you a single view of business performance for the selected date range.'],
        bullets: [
          'Top KPI cards: revenue, ad spend, net profit and ROAS.',
          'Revenue vs spend chart over time, including WooCommerce revenue synced to the global date range.',
          'Real‑time traffic from GA4: active users now and total users in the period.',
          'SEO metrics from Search Console: clicks, impressions, average position and CTR.',
          'If a connection (Google, Meta, TikTok, WooCommerce) is missing, demo data is shown so the screen is never empty.'
        ]
      },
      {
        title: '4. Shared Connections and Users',
        paragraphs: [
          'In the Connections page you configure all integrations once: AI engines, Google, Meta, TikTok, WooCommerce and Shopify. Other pages reuse these connections automatically.'
        ],
        bullets: [
          'AI engines (Gemini / OpenAI / Claude) are stored as a global admin‑level connection and shared with all users.',
          'Only admins can edit AI keys; regular users see connection status only (connected/disconnected).',
          'An admin‑only migration button copies legacy per‑user AI connections into the global shared document.',
          'You can also configure WooCommerce, Meta, TikTok and Shopify keys according to each platform’s requirements.'
        ]
      },
      {
        title: '5. Creative Lab',
        paragraphs: [
          'The Creative Lab uses the shared AI engines to generate creatives (images and copy) based on your real store data.'
        ],
        bullets: [
          'Pick a connected WooCommerce product so the AI can use its name, description and price.',
          'Product descriptions are cleaned from HTML and used as structured prompts for AI.',
          'Choose what to generate: image, ad copy or video script — with a strict rule that the AI does not change the product itself, only the background and surrounding elements.',
          'During generation you see a live runtime timer and visual steps (calling AI engines, processing and preparing the preview).',
          'You can download results to your computer or reuse them in campaigns.'
        ]
      },
      {
        title: '6. Campaigns and AI Recommendations',
        paragraphs: ['The system centralizes campaigns across platforms and highlights what is working well and what needs attention.'],
        bullets: [
          'Campaigns page: list of Google, Meta and TikTok campaigns with status, spend, ROAS/CPA and more.',
          'AI Recommendations page: actionable suggestions such as increasing budget on winning campaigns, pausing losing ads and improving creatives.',
          'Sort and filter to decide what to do first and see the reasoning behind each recommendation.'
        ]
      },
      {
        title: '7. SEO, Search Analysis and Product SEO',
        paragraphs: [
          'With Search Console and GA4 connected, the system shows keyword performance, top landing pages and SEO opportunities.',
          'On the WooCommerce Products page there is an AI SEO panel that generates 3 proposals per product — SEO title, meta description and image alt texts — formatted for Rank Math and Yoast, and fully editable before saving back to WooCommerce.'
        ]
      },
      {
        title: '8. Products and WooCommerce Financial Data',
        paragraphs: [
          'The Products page syncs your catalog from WooCommerce, while the Profitability page pulls sales data by the same date range used in the top date picker.'
        ],
        bullets: [
          'View product name, SKU, stock status, price and categories directly from your store.',
          'Refresh products to resync with WooCommerce at any time.',
          'Financial reports combine WooCommerce revenue with ad spend from connected platforms.',
          'If no live data is available for a period, demo data keeps charts readable until connections are stabilized.'
        ]
      },
      {
        title: '9. Settings, Languages, Currency and Time Zone',
        paragraphs: [
          'In Settings you control account preferences and how the interface looks.',
          'Changing the interface language (Hebrew, English, Russian, Portuguese, French) also changes this guide and the privacy policy.',
          'You can choose a preferred currency (ILS, USD, EUR); all financial screens then use the correct symbol and formatting.',
          'System time is based on the Jerusalem time zone alongside the user’s local time zone, so dates and reports stay consistent.'
        ],
        bullets: [
          'Manage profile details, branding and agency data.',
          'Choose a subscription plan, manage billing and payment methods.',
          'Confirm Terms of Use and Privacy Policy before purchasing, to comply with regulation.'
        ]
      }
    ],
    backHome: 'Back to home page'
  },
  ru: {
    title: 'BScale AI — руководство по системе',
    subtitle:
      'Кратко о том, как подключить платформы, использовать AI, отчёты по WooCommerce и лабораторию креатива.',
    sections: [
      {
        title: '1. Вход и структура',
        paragraphs: [
          'Зайдите на bscale.co.il и войдите в систему. После входа открывается обзорный дашборд (/app).',
          'В левой панели находятся разделы: Обзор, Прибыльность, Бюджет, Кампании, рекомендации AI, SEO, Creative Lab, Товары, Подключения, Пользователи (админ) и Настройки.'
        ]
      },
      {
        title: '2. Системные требования и рекомендуемые подключения',
        paragraphs: [
          'Чтобы использовать BScale AI на полную мощность, рекомендуется подключить все основные рекламные и аналитические платформы, с которыми вы работаете.'
        ],
        bullets: [
          'Google Ads — для данных по кампаниям, бюджетам и конверсиям.',
          'Google Search Console — для SEO‑аналитики, органических позиций и поисковых запросов.',
          'Google Analytics 4 — для анализа трафика и поведения пользователей на сайте.',
          'Meta Ads (Facebook / Instagram) — для кампаний в соцсетях и синхронизации аудиторий.',
          'TikTok Ads — для видеокампаний и метрик эффективности.',
          'WooCommerce — синхронизация товаров, заказов и отчётов по прибыли для сайтов на WordPress.',
          'Shopify — синхронизация товаров и продаж для магазинов Shopify.'
        ]
      },
      {
        title: '3. Обзорный дашборд',
        paragraphs: ['Основной экран показывает состояние бизнеса за выбранный период.'],
        bullets: [
          'Карточки с выручкой, расходами на рекламу, чистой прибылью и ROAS.',
          'График доход vs расход, включая данные WooCommerce по выбранному диапазону дат.',
          'Онлайн‑трафик из GA4: активные пользователи сейчас и всего за период.',
          'SEO‑данные из Search Console: клики, показы, средняя позиция и CTR.',
          'Если какое‑то подключение отсутствует, вместо пустого экрана показываются демо‑данные.'
        ]
      },
      {
        title: '4. Общие подключения и пользователи',
        paragraphs: [
          'В разделе «Подключения» вы один раз настраиваете интеграции: AI‑движки, Google, Meta, TikTok, WooCommerce и Shopify. Далее ими пользуются все модули.'
        ],
        bullets: [
          'AI‑движки (Gemini / OpenAI / Claude) хранятся как глобальное подключение на уровне администратора и доступны всем пользователям.',
          'Редактировать ключи могут только админы, остальные видят только статус (подключено/отключено).',
          'Кнопка миграции (только для админа) переносит старые пользовательские подключения AI в общий документ.',
          'Также задаются ключи WooCommerce, Meta, TikTok и Shopify по требованиям каждой платформы.'
        ]
      },
      {
        title: '5. Creative Lab',
        paragraphs: [
          'Creative Lab использует общие AI‑движки и реальные данные магазина для генерации креативов (изображений и текстов).'
        ],
        bullets: [
          'Выберите товар из WooCommerce, чтобы AI использовал его название, описание и цену.',
          'Описания очищаются от HTML и используются как промпт.',
          'Можно создать изображение, текст объявления или сценарий видео. AI не меняет сам товар на картинке, только фон и дополнительные элементы.',
          'Во время генерации показывается таймер выполнения и визуальные этапы процесса.',
          'Результаты можно скачать на компьютер или использовать в кампаниях.'
        ]
      },
      {
        title: '6. Кампании и рекомендации AI',
        paragraphs: ['Система объединяет кампании с разных платформ и показывает, что работает хорошо, а что требует внимания.'],
        bullets: [
          'Раздел «Кампании»: список Google, Meta и TikTok с статусом, расходом, ROAS/CPA и др.',
          'Раздел рекомендаций AI: действия — увеличить бюджет, остановить убыточные объявления, обновить креатив.',
          'Фильтры и сортировка помогают выбрать приоритеты и понять логику рекомендаций.'
        ]
      },
      {
        title: '7. SEO, анализ поиска и SEO для товаров',
        paragraphs: [
          'Подключения к Search Console и GA4 позволяют видеть эффективность ключевых запросов, страницы‑лидеры и SEO‑возможности.',
          'В разделе «Товары» WooCommerce есть панель AI SEO, которая даёт 3 предложения по каждому товару (заголовок SEO, мета‑описание, alt‑тексты для изображений) в формате Rank Math и Yoast.'
        ]
      },
      {
        title: '8. Товары и финансовые данные WooCommerce',
        paragraphs: [
          'Раздел «Товары» синхронизирует каталог из WooCommerce, а раздел «Прибыльность» подтягивает продажи за тот же период, что выбран в верхнем селекторе дат.'
        ]
      },
      {
        title: '9. Настройки, языки, валюта и время',
        paragraphs: [
          'В настройках управляются параметры аккаунта и внешний вид интерфейса.',
          'Смена языка (иврит, английский, русский, португальский, французский) также меняет язык этого руководства и политики конфиденциальности.',
          'Можно выбрать валюту (ILS, USD, EUR), и все финансовые экраны используют правильный формат.',
          'Системное время базируется на часовом поясе Иерусалима плюс локальный часовой пояс пользователя для согласованных отчётов.'
        ]
      }
    ],
    backHome: 'Назад на главную'
  },
  pt: {
    title: 'BScale AI — Guia Rápido',
    subtitle:
      'Como trabalhar passo a passo com a plataforma — conexões, AI, relatórios WooCommerce e Creative Lab.',
    sections: [
      {
        title: '1. Login e estrutura',
        paragraphs: [
          'Acesse bscale.co.il e faça login. Após entrar, você verá o painel geral em /app.',
          'No menu lateral você encontra: Geral, Lucratividade, Orçamento, Campanhas, Recomendações AI, SEO, Creative Lab, Produtos, Conexões, Usuários (admin) e Configurações & Privacidade.'
        ]
      },
      {
        title: '2. Requisitos de sistema e conexões recomendadas',
        paragraphs: [
          'Para aproveitar todo o potencial do BScale AI, recomendamos conectar todas as principais plataformas de mídia, analytics e ecommerce que você utiliza.'
        ],
        bullets: [
          'Google Ads — dados de campanhas, orçamentos e conversões.',
          'Google Search Console — SEO, posições orgânicas e termos de busca.',
          'Google Analytics 4 — tráfego do site, comportamento e retenção.',
          'Meta Ads (Facebook / Instagram) — campanhas em redes sociais e públicos.',
          'TikTok Ads — campanhas em vídeo e métricas de desempenho.',
          'WooCommerce — sincronização de produtos, pedidos e relatórios de lucratividade para lojas WordPress.',
          'Shopify — sincronização de produtos e vendas para lojas Shopify.'
        ]
      },
      {
        title: '3. Painel Geral',
        paragraphs: ['A tela principal resume o desempenho do negócio para o período selecionado.'],
        bullets: [
          'Cards superiores com receita, gasto em mídia, lucro líquido e ROAS.',
          'Gráfico de receita vs gasto ao longo do tempo, incluindo dados do WooCommerce sincronizados com o seletor de datas.',
          'Tráfego em tempo real do GA4 e visão geral de SEO do Search Console.',
          'Quando alguma integração falta, são exibidos dados de demonstração para manter o painel utilizável.'
        ]
      },
      {
        title: '4. Conexões compartilhadas',
        paragraphs: [
          'Em Conexões você configura uma vez os motores de AI, Google, Meta, TikTok, WooCommerce e Shopify. Os outros módulos usam estas conexões automaticamente.'
        ],
        bullets: [
          'Gemini, OpenAI e Claude são salvos como conexão global administradora e compartilhados com todos os usuários.',
          'Somente admins podem editar as chaves; usuários comuns veem apenas o status.',
          'Um botão de migração copia conexões antigas por usuário para o documento global.',
          'WooCommerce, Meta, TikTok e Shopify usam os campos padrão exigidos por cada plataforma.'
        ]
      },
      {
        title: '5. Creative Lab',
        paragraphs: [
          'O Creative Lab usa os motores de AI conectados para gerar criativos baseados nos produtos reais da loja.'
        ],
        bullets: [
          'Selecione um produto WooCommerce conectado para usar nome, descrição e preço.',
          'As descrições são limpas de HTML antes de virar prompt para o AI.',
          'O AI não pode alterar o produto na imagem — apenas fundo e elementos gráficos.',
          'Um cronômetro mostra o tempo de execução e as etapas do processo.',
          'Você pode baixar os resultados ou aproveitá‑los em campanhas.'
        ]
      },
      {
        title: '6. Campanhas e recomendações AI',
        paragraphs: ['A plataforma centraliza campanhas de Google, Meta e TikTok e sugere otimizações claras.']
      },
      {
        title: '7. SEO e SEO de Produtos',
        paragraphs: [
          'Com GA4 e Search Console conectados, você vê desempenho de palavras‑chave e páginas.',
          'Na página de Produtos WooCommerce há um painel de SEO com AI que gera 3 propostas por produto em formato amigável ao Rank Math e Yoast.'
        ]
      },
      {
        title: '8. Finanças WooCommerce',
        paragraphs: [
          'Os relatórios de lucratividade combinam receita do WooCommerce com gastos de mídia das plataformas conectadas, sempre sincronizados com o seletor de datas global.'
        ]
      },
      {
        title: '9. Idiomas, moeda e horário',
        paragraphs: [
          'Em Configurações você escolhe idioma (he, en, ru, pt, fr), moeda (ILS, USD, EUR) e preferências da conta.',
          'A alteração de idioma também atualiza este guia e a política de privacidade.',
          'O horário do sistema usa o fuso de Jerusalém junto com o fuso local do usuário para manter relatórios consistentes.'
        ]
      }
    ],
    backHome: 'Voltar para a página inicial'
  },
  fr: {
    title: 'BScale AI — Guide de démarrage',
    subtitle:
      "Comment utiliser la plateforme étape par étape — connexions, IA, rapports WooCommerce et Creative Lab.",
    sections: [
      {
        title: '1. Connexion et structure',
        paragraphs: [
          'Rendez‑vous sur bscale.co.il et connectez‑vous. Après connexion, vous arrivez sur le tableau de bord général (/app).',
          "Le menu latéral contient : Aperçu, Rentabilité, Budget, Campagnes, Recommandations IA, SEO, Creative Lab, Produits, Connexions, Utilisateurs (admin) et Paramètres & Confidentialité."
        ]
      },
      {
        title: '2. Prérequis système et connexions recommandées',
        paragraphs: [
          'Pour tirer pleinement parti de BScale AI, il est recommandé de connecter toutes les principales plateformes de publicité, d’analytics et d’e‑commerce que vous utilisez.'
        ],
        bullets: [
          'Google Ads — données de campagnes, budgets et conversions.',
          'Google Search Console — analyse SEO, positions organiques et requêtes de recherche.',
          'Google Analytics 4 — trafic du site, comportement et rétention.',
          'Meta Ads (Facebook / Instagram) — campagnes sur les réseaux sociaux et audiences.',
          'TikTok Ads — campagnes vidéo et indicateurs de performance.',
          'WooCommerce — synchronisation des produits, commandes et rapports de rentabilité pour les boutiques WordPress.',
          'Shopify — synchronisation des produits et ventes pour les boutiques Shopify.'
        ]
      },
      {
        title: '3. Tableau de bord',
        paragraphs: [
          'L’écran principal présente l’état de votre activité pour la période sélectionnée, y compris les données WooCommerce synchronisées.'
        ]
      },
      {
        title: '4. Connexions partagées',
        paragraphs: [
          "Dans Connexions vous configurez les moteurs d'IA, Google, Meta, TikTok, WooCommerce et Shopify. Toutes les autres pages réutilisent ces paramètres."
        ],
        bullets: [
          'Gemini, OpenAI et Claude sont enregistrés comme connexion globale administrateur et partagés avec tous les utilisateurs.',
          'Seuls les administrateurs peuvent modifier les clés ; les autres voient uniquement le statut.',
          'Un bouton de migration (admin) copie les anciennes connexions par utilisateur vers le document global.'
        ]
      },
      {
        title: '5. Creative Lab',
        paragraphs: [
          "Creative Lab utilise les moteurs d'IA connectés pour générer des visuels et des textes à partir de vos produits WooCommerce."
        ]
      },
      {
        title: '6. Campagnes et recommandations IA',
        paragraphs: [
          'Les campagnes Google, Meta et TikTok sont centralisées et l’IA propose des actions rapides (augmenter un budget gagnant, arrêter des annonces peu rentables, tester de nouveaux créatifs).'
        ]
      },
      {
        title: '7. SEO et SEO Produits',
        paragraphs: [
          "Avec GA4 et Search Console, vous suivez les mots‑clés, les pages clés et les opportunités SEO.",
          'Sur la page Produits WooCommerce, un panneau SEO IA génère 3 propositions par produit (titre SEO, meta description, textes alternatifs) dans un format compatible Rank Math / Yoast.'
        ]
      },
      {
        title: '8. Finances WooCommerce',
        paragraphs: [
          'Les rapports de rentabilité combinent les revenus WooCommerce et les dépenses publicitaires, toujours alignés sur la période sélectionnée en haut.'
        ]
      },
      {
        title: '9. Paramètres, langues et devise',
        paragraphs: [
          "Dans Paramètres vous choisissez la langue de l'interface (he, en, ru, pt, fr), la devise (ILS, USD, EUR) et les préférences du compte.",
          'Le changement de langue met aussi à jour ce guide et la politique de confidentialité.',
          "Le système s'appuie sur le fuseau horaire de Jérusalem ainsi que sur le fuseau local de l'utilisateur pour garder des rapports cohérents."
        ]
      }
    ],
    backHome: 'Retour à la page d’accueil'
  }
};

export function Guide() {
  const { language } = useLanguage();
  const content = guideByLang[language] ?? guideByLang.he;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex justify-center px-4 py-10">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{content.title}</h1>
          <p className="text-sm text-gray-500">{content.subtitle}</p>
        </header>

        {content.sections.map((section, idx) => (
          <section key={idx} className="space-y-3 text-sm leading-relaxed">
            <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
            {section.paragraphs?.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="list-disc list-inside space-y-1">
                {section.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <footer className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center text-xs text-gray-500">
          <a href="/" className="text-indigo-600 hover:underline">
            {content.backHome}
          </a>
          <SiteLegalNotice compact className="text-[11px] sm:text-xs text-gray-500" />
        </footer>
      </div>
    </div>
  );
}

