"use client";

import React from 'react';
import { useLanguage, type Language } from '../contexts/LanguageContext';
import { SiteLegalNotice } from '../components/SiteLegalNotice';

type Article = {
  id: string;
  title: string;
  summary: string;
  paragraphs: string[];
  links: { label: string; href: string }[];
};

const ARTICLES_BY_LANG: Record<Language, Article[]> = {
  he: [
    {
      id: 'article-1',
      title: 'למה כל כך קשה לנהל כמה פלטפורמות פרסום במקביל',
      summary:
        'בעלי עסקים ומנהלי שיווק מרגישים שהם טובעים בין Google Ads, Meta, TikTok ומערכות אנליטיקה שונות. כל מערכת מציגה מספרים אחרים, שפה אחרת והיגיון עבודה שונה.',
      paragraphs: [
        'כאשר הקמפיינים מפוזרים בין כמה פלטפורמות, מתקבלת תמונה חלקית ולא עסקית. בכל ממשק יש KPI אחר, חלון זמן אחר ודרך שונה למדוד הצלחה. במצב כזה קל מאוד לקבל החלטות מתוך לחץ במקום מתוך נתונים אמיתיים.',
        'הבעיה מחמירה כאשר צריך גם לעקוב אחרי מכירות מהחנות, לבדוק עלויות רכישה, לעדכן קהלים ולשמור על עקביות בקריאייטיב. במקום להתמקד בצמיחה, רוב הזמן הולך על מעבר בין מסכים וניסיון להבין מי צודק.',
        'הפתרון המעשי הוא לרכז את המידע העסקי במקום אחד. כשיש דאשבורד מרכזי שמציג נתוני קמפיינים, SEO ומכירות, אפשר לזהות במהירות מה עובד, מה צריך לעצור ואיפה כדאי להשקיע כבר היום.',
      ],
      links: [
        { label: 'לקריאה על ניהול חכם של קידום דיגיטלי', href: '#article-2' },
        { label: 'לקריאה על AI שמבין אלגוריתמים', href: '#article-3' },
        { label: 'לקריאה על קריאייטיב ואוטומציות', href: '#article-4' },
        { label: 'עמוד חיבורים ואינטגרציות', href: '/connections' },
        { label: 'מדריך הפעלה מלא למערכת', href: '/guide' },
      ],
    },
    {
      id: 'article-2',
      title: 'הצורך בניהול חכם של קידום דיגיטלי, וכל העסק בכף ידך',
      summary:
        'ניהול דיגיטלי חכם אומר לראות את כל העסק בתמונה אחת: פרסום, תנועה, SEO, מכירות ורווחיות. כאשר הנתונים יושבים יחד, ההחלטות הופכות למהירות ומדויקות.',
      paragraphs: [
        'עסק צומח חייב שליטה בזמן אמת. מנהל שיווק צריך לדעת לא רק כמה הוציא, אלא כמה נכנס, איזה קמפיין באמת רווחי, ואילו פעולות ישפרו תוצאות כבר השבוע. זה לא עוד דוח, זו מערכת קבלת החלטות.',
        'כשכל המדדים מרוכזים במסך אחד אפשר לעבוד חכם יותר: לתעדף קמפיינים, להקטין בזבוז תקציב, להגדיל חשיפה לערוצים מנצחים ולוודא שכל שקל משרת מטרה עסקית ברורה.',
        'היתרון הגדול הוא תחושת שליטה. במקום לרדוף אחרי דאטא, הדאטה מגיע אליך. כך כל העסק נמצא ממש בכף היד שלך, עם יכולת פעולה מיידית ולא רק מעקב פסיבי.',
      ],
      links: [
        { label: 'לקריאה על הקושי במעבר בין פלטפורמות', href: '#article-1' },
        { label: 'לקריאה על היתרון של כלי AI מודרני', href: '#article-3' },
        { label: 'לקריאה על קריאייטיב חכם ואוטומציות', href: '#article-4' },
        { label: 'עמוד סקירה כללית', href: '/app' },
        { label: 'עמוד רווחיות ודוחות כספיים', href: '/profitability' },
      ],
    },
    {
      id: 'article-3',
      title: 'היתרון בכלי AI מודרני שמבין אלגוריתמים ומוביל קידום מנצח',
      summary:
        'AI מודרני יודע לנתח נפחי נתונים, לזהות דפוסים ולהציע פעולות עם עדיפות עסקית. הוא לא מחליף את מנהל השיווק, אלא נותן לו יתרון מהירות ודיוק.',
      paragraphs: [
        'בעולם פרסום תחרותי, אלגוריתמים משתנים כל הזמן. מה שעבד החודש לא תמיד יעבוד בחודש הבא. כלי AI טוב מנתח ביצועים היסטוריים, משווה ערוצים ומזהה איפה הסיכוי הגבוה לשיפור תשואה.',
        'כאשר עובדים נכון עם AI מתקבלת שותפות אמיתית: המערכת מציעה כיווני פעולה, והצוות העסקי מגדיר אסטרטגיה, סדרי עדיפויות ומיתוג. כך מקבלים גם דיוק טכני וגם שליטה אנושית מלאה.',
        'התוצאה היא קידום מנצח ללא פשרות: פחות ניחושים, יותר החלטות מבוססות נתונים, ושיפור רציף בביצועים לאורך זמן.',
      ],
      links: [
        { label: 'לקריאה על כאב ריבוי הממשקים', href: '#article-1' },
        { label: 'לקריאה על ניהול חכם בכף היד', href: '#article-2' },
        { label: 'לקריאה על קריאייטיב חכם ואוטומציות', href: '#article-4' },
        { label: 'עמוד המלצות AI', href: '/ai-recommendations' },
        { label: 'עמוד ניתוח חיפושים', href: '/search-analysis' },
      ],
    },
    {
      id: 'article-4',
      title: 'יצירת קריאייטיב חכמה ומדויקת עם אוטומציות ואופטימיזציה מיטבית',
      summary:
        'קריאייטיב טוב הוא מנוע צמיחה, אבל כדי לשמור על ביצועים צריך גם תהליך עבודה חכם. כאן נכנסים אוטומציות, בדיקות ורצף אופטימיזציה.',
      paragraphs: [
        'יצירת מודעות צריכה להיות מבוססת נתונים ולא תחושת בטן. כשמחברים בין נתוני מוצרים, קהלים וביצועים קודמים, אפשר לייצר קריאייטיב שמתאים לקהל הנכון ברגע הנכון.',
        'אוטומציות חכמות חוסכות זמן ומקטינות טעויות אנוש. הן מאפשרות להריץ בדיקות וריאציות, לעדכן תקציבים לפי תוצאות ולשפר מודעות חלשות לפני שהן שורפות תקציב.',
        'השילוב בין קריאייטיב חכם, אופטימיזציה שוטפת ותובנות AI יוצר מערכת פרסום בריאה יותר. כך העסק מתקדם בצורה יציבה, מדויקת ורווחית.',
      ],
      links: [
        { label: 'לקריאה על אתגר ניהול כמה פלטפורמות', href: '#article-1' },
        { label: 'לקריאה על ניהול חכם של קידום דיגיטלי', href: '#article-2' },
        { label: 'לקריאה על AI שמבין אלגוריתמים', href: '#article-3' },
        { label: 'עמוד מעבדת יצירה', href: '/creative-lab' },
        { label: 'עמוד אוטומציות', href: '/automations' },
      ],
    },
  ],
  en: [
    {
      id: 'article-1',
      title: 'Why it is so hard to manage multiple ad platforms at once',
      summary:
        'Business owners and marketers often feel lost between Google Ads, Meta, TikTok, and analytics tools. Each platform speaks a different language and reports different numbers.',
      paragraphs: [
        'When campaigns are spread across several platforms, you get a fragmented view instead of a business level view. Every interface uses a different KPI, date range, and success definition. That makes it easy to react from pressure instead of real data.',
        'The challenge grows when you also need to track store sales, monitor acquisition costs, update audiences, and keep creative consistent. Instead of focusing on growth, time is wasted switching screens and trying to understand which source is right.',
        'A practical solution is to centralize business data in one place. With a single dashboard for campaigns, SEO, and sales, you can quickly see what works, what to stop, and where to invest today.',
      ],
      links: [
        { label: 'Read about smart digital management', href: '#article-2' },
        { label: 'Read about AI that understands algorithms', href: '#article-3' },
        { label: 'Read about creative and automation', href: '#article-4' },
        { label: 'Connections and integrations page', href: '/connections' },
        { label: 'Full system guide', href: '/guide' },
      ],
    },
    {
      id: 'article-2',
      title: 'Why smart digital management keeps your whole business in your hand',
      summary:
        'Smart management means seeing advertising, traffic, SEO, sales, and profitability together. When the data lives in one place, decisions become faster and more accurate.',
      paragraphs: [
        'A growing business needs real time control. A marketing manager must know not only what was spent, but also what came back, which campaign is actually profitable, and what actions can improve performance this week.',
        'When all key metrics are in one screen, teams can work smarter: prioritize campaigns, reduce waste, increase exposure to winning channels, and make sure every dollar supports a clear business goal.',
        'The biggest gain is control. Instead of chasing data, data comes to you. That is how the whole business feels manageable and actionable from one place.',
      ],
      links: [
        { label: 'Read about multi platform management pain', href: '#article-1' },
        { label: 'Read about modern AI advantage', href: '#article-3' },
        { label: 'Read about smart creative and automation', href: '#article-4' },
        { label: 'Overview dashboard page', href: '/app' },
        { label: 'Profitability reports page', href: '/profitability' },
      ],
    },
    {
      id: 'article-3',
      title: 'The advantage of modern AI that understands algorithms and drives winning growth',
      summary:
        'Modern AI can analyze large data volumes, detect patterns, and recommend business first actions. It does not replace the marketer, it gives the marketer speed and precision.',
      paragraphs: [
        'In competitive advertising, algorithms change constantly. What worked this month may not work next month. A strong AI assistant analyzes historical performance, compares channels, and highlights the best opportunities to improve returns.',
        'When teams use AI correctly, they get a real partnership: the system recommends actions, while the business team defines strategy, priorities, and brand voice. This gives technical accuracy with full human control.',
        'The result is stronger marketing with fewer guesses, more data driven decisions, and steady performance improvement over time.',
      ],
      links: [
        { label: 'Read about platform overload challenges', href: '#article-1' },
        { label: 'Read about smart management from one place', href: '#article-2' },
        { label: 'Read about creative and automation workflows', href: '#article-4' },
        { label: 'AI recommendations page', href: '/ai-recommendations' },
        { label: 'Search analysis page', href: '/search-analysis' },
      ],
    },
    {
      id: 'article-4',
      title: 'Smart creative generation with automation and continuous optimization',
      summary:
        'Great creative drives growth, but performance stays strong only with a smart process. This is where automation, testing, and optimization come in.',
      paragraphs: [
        'Ad creation should be data based, not gut based. When product data, audience insights, and past performance are connected, teams can generate creative that fits the right audience at the right moment.',
        'Smart automations save time and reduce human mistakes. They help run variation tests, update budgets based on results, and improve weak ads before they burn budget.',
        'The combination of smart creative, ongoing optimization, and AI insights builds a healthier advertising system. The business grows in a stable, precise, and profitable way.',
      ],
      links: [
        { label: 'Read about managing multiple platforms', href: '#article-1' },
        { label: 'Read about smart digital management', href: '#article-2' },
        { label: 'Read about AI algorithm intelligence', href: '#article-3' },
        { label: 'Creative lab page', href: '/creative-lab' },
        { label: 'Automations page', href: '/automations' },
      ],
    },
  ],
  ru: [
    {
      id: 'article-1',
      title: 'Почему так сложно управлять сразу несколькими рекламными платформами',
      summary:
        'Владельцы бизнеса и маркетологи часто теряются между Google Ads, Meta, TikTok и разными системами аналитики. У каждой платформы свои метрики и своя логика.',
      paragraphs: [
        'Когда кампании разбросаны по разным платформам, вы видите фрагменты, а не целостную картину бизнеса. В каждом интерфейсе свой KPI, свой период и свой подход к оценке результата.',
        'Ситуация усложняется, когда нужно еще следить за продажами магазина, стоимостью привлечения, аудиториями и креативами. Вместо роста команда тратит время на переключение между экранами.',
        'Практичное решение - собрать бизнес данные в одном месте. Единый дашборд по кампаниям, SEO и продажам помогает быстро понять, что работает, что остановить и куда вложить бюджет.',
      ],
      links: [
        { label: 'О smart управлении digital продвижением', href: '#article-2' },
        { label: 'О преимуществах AI, который понимает алгоритмы', href: '#article-3' },
        { label: 'О креативах и автоматизациях', href: '#article-4' },
        { label: 'Страница интеграций', href: '/connections' },
        { label: 'Полный гайд по системе', href: '/guide' },
      ],
    },
    {
      id: 'article-2',
      title: 'Зачем нужно умное управление digital продвижением, когда весь бизнес под рукой',
      summary:
        'Умное управление - это единый взгляд на рекламу, трафик, SEO, продажи и прибыльность. Когда данные рядом, решения принимаются быстрее и точнее.',
      paragraphs: [
        'Растущему бизнесу нужен контроль в реальном времени. Маркетолог должен видеть не только расходы, но и возврат, реальную прибыльность кампаний и действия, которые улучшат результат уже на этой неделе.',
        'Когда ключевые показатели собраны в одном экране, проще расставлять приоритеты, сокращать лишние расходы, усиливать сильные каналы и связывать бюджет с бизнес целями.',
        'Главное преимущество - чувство контроля. Вы не гоняетесь за данными, данные приходят к вам. Так бизнесом можно управлять быстро и уверенно.',
      ],
      links: [
        { label: 'О сложности работы с несколькими платформами', href: '#article-1' },
        { label: 'О преимуществах современного AI', href: '#article-3' },
        { label: 'О smart креативе и автоматизациях', href: '#article-4' },
        { label: 'Обзорный дашборд', href: '/app' },
        { label: 'Страница прибыльности', href: '/profitability' },
      ],
    },
    {
      id: 'article-3',
      title: 'Преимущество современного AI, который понимает алгоритмы и усиливает продвижение',
      summary:
        'Современный AI умеет анализировать большие объемы данных, находить закономерности и предлагать действия с бизнес приоритетом.',
      paragraphs: [
        'В конкурентной рекламе алгоритмы меняются постоянно. То, что работало вчера, может перестать работать завтра. Хороший AI анализирует историю, сравнивает каналы и показывает наиболее перспективные точки роста.',
        'При правильной работе с AI появляется партнерство: система предлагает действия, а команда задает стратегию, приоритеты и тон бренда. Так сохраняется и точность, и человеческий контроль.',
        'Итог - меньше догадок, больше решений на основе данных и стабильный рост эффективности во времени.',
      ],
      links: [
        { label: 'О перегрузке интерфейсами', href: '#article-1' },
        { label: 'О smart управлении из одного места', href: '#article-2' },
        { label: 'О креативе и автоматизациях', href: '#article-4' },
        { label: 'Страница AI рекомендаций', href: '/ai-recommendations' },
        { label: 'Страница анализа поиска', href: '/search-analysis' },
      ],
    },
    {
      id: 'article-4',
      title: 'Умное создание креативов с автоматизациями и оптимизацией',
      summary:
        'Сильный креатив дает рост, но стабильный результат требует процесса: автоматизаций, тестов и постоянной оптимизации.',
      paragraphs: [
        'Создание рекламы должно опираться на данные, а не на интуицию. Когда объединены данные продукта, аудитории и прошлой эффективности, креатив лучше попадает в нужного клиента.',
        'Умные автоматизации экономят время и уменьшают количество ошибок. Они помогают тестировать варианты, корректировать бюджеты по результатам и улучшать слабые объявления заранее.',
        'Связка smart креатива, регулярной оптимизации и AI инсайтов создает более здоровую рекламную систему и стабильный прибыльный рост бизнеса.',
      ],
      links: [
        { label: 'О вызове управления несколькими платформами', href: '#article-1' },
        { label: 'О smart управлении digital продвижением', href: '#article-2' },
        { label: 'Об AI, который понимает алгоритмы', href: '#article-3' },
        { label: 'Страница creative lab', href: '/creative-lab' },
        { label: 'Страница автоматизаций', href: '/automations' },
      ],
    },
  ],
  pt: [
    {
      id: 'article-1',
      title: 'Por que e tao dificil gerenciar varias plataformas de anuncios ao mesmo tempo',
      summary:
        'Donos de negocio e gestores de marketing se perdem entre Google Ads, Meta, TikTok e ferramentas de analise. Cada plataforma mostra numeros e logicas diferentes.',
      paragraphs: [
        'Quando as campanhas ficam espalhadas, a visao do negocio fica fragmentada. Cada interface usa um KPI, um periodo e uma logica de sucesso diferente. Isso leva a decisoes por pressao e nao por dados reais.',
        'O desafio aumenta quando tambem e preciso acompanhar vendas da loja, custo de aquisicao, audiencias e consistencia de criativos. Em vez de crescer, o time perde tempo trocando de tela.',
        'A solucao pratica e centralizar os dados em um unico lugar. Com um dashboard unico de campanhas, SEO e vendas, fica facil ver o que funciona, o que pausar e onde investir agora.',
      ],
      links: [
        { label: 'Leia sobre gestao inteligente de marketing digital', href: '#article-2' },
        { label: 'Leia sobre AI que entende algoritmos', href: '#article-3' },
        { label: 'Leia sobre criativos e automacoes', href: '#article-4' },
        { label: 'Pagina de conexoes e integracoes', href: '/connections' },
        { label: 'Guia completo da plataforma', href: '/guide' },
      ],
    },
    {
      id: 'article-2',
      title: 'A necessidade de gestao inteligente do digital com todo o negocio na sua mao',
      summary:
        'Gestao digital inteligente significa enxergar publicidade, trafego, SEO, vendas e rentabilidade no mesmo painel. Com dados unificados, as decisoes ficam mais rapidas e precisas.',
      paragraphs: [
        'Um negocio em crescimento precisa de controle em tempo real. O gestor precisa saber nao so quanto gastou, mas quanto retornou, qual campanha gera lucro e quais acoes melhoram os resultados ja nesta semana.',
        'Com todos os indicadores em uma tela, o trabalho fica mais inteligente: priorizar campanhas, reduzir desperdicio, aumentar investimento em canais vencedores e alinhar cada valor ao objetivo do negocio.',
        'O maior ganho e o controle. Em vez de correr atras de dados, os dados chegam ate voce. Assim, todo o negocio fica acessivel e acionavel na pratica.',
      ],
      links: [
        { label: 'Leia sobre a dor de multiplas plataformas', href: '#article-1' },
        { label: 'Leia sobre vantagem de AI moderno', href: '#article-3' },
        { label: 'Leia sobre criativo inteligente e automacao', href: '#article-4' },
        { label: 'Pagina de visao geral', href: '/app' },
        { label: 'Pagina de rentabilidade', href: '/profitability' },
      ],
    },
    {
      id: 'article-3',
      title: 'A vantagem de um AI moderno que entende algoritmos e acelera o crescimento',
      summary:
        'AI moderno analisa grandes volumes de dados, identifica padroes e sugere acoes com prioridade de negocio. Ele nao substitui o gestor, ele aumenta velocidade e precisao.',
      paragraphs: [
        'No mercado competitivo, os algoritmos mudam o tempo todo. O que funcionou neste mes pode nao funcionar no proximo. Um bom AI compara canais, analisa historico e mostra oportunidades reais de melhora.',
        'Quando AI e usado da forma certa, surge uma parceria forte: a plataforma recomenda caminhos e o time define estrategia, prioridades e posicionamento de marca.',
        'O resultado e menos achismo, mais decisoes orientadas por dados e melhoria continua de performance.',
      ],
      links: [
        { label: 'Leia sobre excesso de interfaces', href: '#article-1' },
        { label: 'Leia sobre gestao inteligente em uma tela', href: '#article-2' },
        { label: 'Leia sobre criativo e automacoes', href: '#article-4' },
        { label: 'Pagina de recomendacoes AI', href: '/ai-recommendations' },
        { label: 'Pagina de analise de busca', href: '/search-analysis' },
      ],
    },
    {
      id: 'article-4',
      title: 'Geracao inteligente de criativos com automacoes e otimizacao continua',
      summary:
        'Criativo forte gera crescimento, mas para sustentar resultado e preciso processo: automacao, testes e otimizacao constante.',
      paragraphs: [
        'Criar anuncios deve ser orientado por dados e nao por intuicao. Quando produto, audiencia e desempenho historico estao conectados, os criativos ficam mais relevantes.',
        'Automacoes inteligentes economizam tempo e reduzem erros humanos. Elas ajudam a testar variacoes, ajustar orcamentos por resultado e melhorar anuncios fracos antes de desperdicarem verba.',
        'A combinacao de criativo inteligente, otimizacao continua e insights de AI cria um sistema de marketing mais saudavel, estavel e lucrativo.',
      ],
      links: [
        { label: 'Leia sobre gerir varias plataformas', href: '#article-1' },
        { label: 'Leia sobre gestao inteligente digital', href: '#article-2' },
        { label: 'Leia sobre AI que entende algoritmos', href: '#article-3' },
        { label: 'Pagina de creative lab', href: '/creative-lab' },
        { label: 'Pagina de automacoes', href: '/automations' },
      ],
    },
  ],
  fr: [
    {
      id: 'article-1',
      title: 'Pourquoi il est si difficile de gerer plusieurs plateformes publicitaires en meme temps',
      summary:
        'Les dirigeants et responsables marketing se perdent entre Google Ads, Meta, TikTok et les outils analytics. Chaque plateforme affiche des chiffres et une logique differents.',
      paragraphs: [
        'Quand les campagnes sont dispersees, la vision business devient partielle. Chaque interface utilise ses propres KPI, ses propres periodes et sa propre definition de performance.',
        'La difficulte augmente quand il faut aussi suivre les ventes e commerce, le cout d acquisition, les audiences et la coherence creative. Au lieu de piloter la croissance, on passe son temps a changer d ecran.',
        'La solution concrete est de centraliser les donnees dans un seul endroit. Un dashboard unique campagnes, SEO et ventes permet de voir vite ce qui marche, ce qu il faut stopper et ou investir.',
      ],
      links: [
        { label: 'Lire sur la gestion digitale intelligente', href: '#article-2' },
        { label: 'Lire sur un AI qui comprend les algorithmes', href: '#article-3' },
        { label: 'Lire sur creative et automatisations', href: '#article-4' },
        { label: 'Page connexions et integrations', href: '/connections' },
        { label: 'Guide complet de la plateforme', href: '/guide' },
      ],
    },
    {
      id: 'article-2',
      title: 'Le besoin d une gestion digitale intelligente avec toute l activite dans la main',
      summary:
        'Une gestion intelligente consiste a voir publicite, trafic, SEO, ventes et rentabilite ensemble. Quand les donnees sont unifiees, les decisions deviennent plus rapides et precises.',
      paragraphs: [
        'Une entreprise en croissance a besoin de controle en temps reel. Le responsable doit connaitre non seulement la depense, mais aussi le retour, la rentabilite reelle et les actions prioritaires a lancer cette semaine.',
        'Avec tous les indicateurs sur un seul ecran, on peut prioriser les campagnes, reduire le gaspillage, renforcer les canaux gagnants et aligner chaque euro sur un objectif business clair.',
        'Le principal benefice est le controle. Au lieu de courir apres la data, la data vient a vous. Toute l activite devient pilotable depuis un point unique.',
      ],
      links: [
        { label: 'Lire sur la complexite multi plateformes', href: '#article-1' },
        { label: 'Lire sur l avantage d un AI moderne', href: '#article-3' },
        { label: 'Lire sur creative intelligent et automatisation', href: '#article-4' },
        { label: 'Page de vue d ensemble', href: '/app' },
        { label: 'Page rentabilite', href: '/profitability' },
      ],
    },
    {
      id: 'article-3',
      title: 'L avantage d un AI moderne qui comprend les algorithmes et accelere la croissance',
      summary:
        'Un AI moderne analyse de grands volumes de donnees, detecte des modeles et recommande des actions a priorite business.',
      paragraphs: [
        'Dans un marche concurrentiel, les algorithmes changent en permanence. Ce qui fonctionne aujourd hui peut baisser demain. Un bon AI compare les canaux, analyse l historique et met en avant les meilleures opportunites.',
        'Quand AI est bien utilise, il cree un vrai partenariat: la plateforme propose des actions et l equipe garde la strategie, les priorites et la voix de marque.',
        'Le resultat est clair: moins d intuitions, plus de decisions basees sur les donnees et une performance qui progresse dans la duree.',
      ],
      links: [
        { label: 'Lire sur la surcharge des interfaces', href: '#article-1' },
        { label: 'Lire sur la gestion intelligente centralisee', href: '#article-2' },
        { label: 'Lire sur creative et automatisations', href: '#article-4' },
        { label: 'Page recommandations AI', href: '/ai-recommendations' },
        { label: 'Page analyse de recherche', href: '/search-analysis' },
      ],
    },
    {
      id: 'article-4',
      title: 'Creation creative intelligente avec automatisations et optimisation continue',
      summary:
        'Un bon creative est un moteur de croissance, mais la performance durable exige une methode: automatisation, tests et optimisation continue.',
      paragraphs: [
        'La creation d annonces doit etre pilotee par les donnees et non par l intuition. Quand produit, audience et historique de performance sont relies, les creatives deviennent plus pertinents.',
        'Les automatisations intelligentes font gagner du temps et reduisent les erreurs humaines. Elles permettent de tester des variations, ajuster les budgets selon les resultats et corriger les annonces faibles plus vite.',
        'La combinaison creative intelligent, optimisation continue et insights AI construit un systeme marketing plus sain, plus stable et plus rentable.',
      ],
      links: [
        { label: 'Lire sur le defi multi plateformes', href: '#article-1' },
        { label: 'Lire sur la gestion digitale intelligente', href: '#article-2' },
        { label: 'Lire sur AI et algorithmes', href: '#article-3' },
        { label: 'Page creative lab', href: '/creative-lab' },
        { label: 'Page automatisations', href: '/automations' },
      ],
    },
  ],
};

const titleByLang: Record<string, string> = {
  he: '4 מאמרים מקצועיים על שיווק דיגיטלי חכם',
  en: '4 Professional Articles on Smart Digital Marketing',
  ru: '4 профессиональные статьи по умному digital маркетингу',
  pt: '4 artigos profissionais sobre marketing digital inteligente',
  fr: '4 articles professionnels sur le marketing digital intelligent',
};

const subtitleByLang: Record<string, string> = {
  he: 'מאמרי עומק עם קישורים פנימיים בין נושאים מרכזיים באתר.',
  en: 'In depth articles with internal links between key site topics.',
  ru: 'Подробные статьи с внутренними ссылками между ключевыми темами сайта.',
  pt: 'Artigos aprofundados com links internos entre os principais temas do site.',
  fr: 'Articles approfondis avec des liens internes entre les principaux sujets du site.',
};

const tocTitleByLang: Record<string, string> = {
  he: 'תוכן עניינים',
  en: 'Table of contents',
  ru: 'Оглавление',
  pt: 'Sumário',
  fr: 'Sommaire',
};

const relatedLinksTitleByLang: Record<string, string> = {
  he: 'קישורים פנימיים מומלצים',
  en: 'Recommended internal links',
  ru: 'Рекомендуемые внутренние ссылки',
  pt: 'Links internos recomendados',
  fr: 'Liens internes recommandés',
};

const backHomeByLang: Record<string, string> = {
  he: 'חזרה לדף הבית',
  en: 'Back to home',
  ru: 'Назад на главную',
  pt: 'Voltar para a página inicial',
  fr: "Retour à l'accueil",
};

const articleLabelByLang: Record<string, string> = {
  he: 'מאמר',
  en: 'Article',
  ru: 'Статья',
  pt: 'Artigo',
  fr: 'Article',
};

export function MarketingArticles() {
  const { language } = useLanguage();
  const articles = ARTICLES_BY_LANG[language as Language] ?? ARTICLES_BY_LANG.he;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex justify-center px-4 py-10">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
            {titleByLang[language] ?? titleByLang.he}
          </h1>
          <p className="text-sm text-gray-500">{subtitleByLang[language] ?? subtitleByLang.he}</p>
        </header>

        <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">
            {tocTitleByLang[language] ?? tocTitleByLang.he}
          </h2>
          <ol className="list-decimal list-inside text-sm space-y-1">
            {articles.map((article) => (
              <li key={article.id}>
                <a href={`#${article.id}`} className="text-indigo-600 hover:underline">
                  {article.title}
                </a>
              </li>
            ))}
          </ol>
        </section>

        {articles.map((article, index) => (
          <article
            id={article.id}
            key={article.id}
            className="space-y-4 border border-gray-200 rounded-2xl p-5 sm:p-7"
          >
            <header className="space-y-2">
              <p className="text-xs font-bold text-indigo-600">
                {(articleLabelByLang[language] ?? articleLabelByLang.he) + ' ' + (index + 1)}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{article.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{article.summary}</p>
            </header>

            <div className="space-y-3 text-sm leading-relaxed text-gray-800">
              {article.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-bold text-gray-900 mb-2">
                {relatedLinksTitleByLang[language] ?? relatedLinksTitleByLang.he}
              </h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                {article.links.map((link) => (
                  <li key={`${article.id}-${link.href}`}>
                    <a href={link.href} className="text-indigo-600 hover:underline">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}

        <footer className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center text-xs text-gray-500">
          <a href="/" className="text-indigo-600 hover:underline">
            {backHomeByLang[language] ?? backHomeByLang.he}
          </a>
          <SiteLegalNotice compact className="text-[11px] sm:text-xs text-gray-500" />
        </footer>
      </div>
    </div>
  );
}

