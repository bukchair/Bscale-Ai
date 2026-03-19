import { useLanguage } from '../contexts/LanguageContext';
import { SiteLegalNotice } from '../components/SiteLegalNotice';

type PolicySection = {
  title: string;
  paragraphs: string[];
};

type PolicyContent = {
  title: string;
  lastUpdatedLabel: string;
  lastUpdatedDate: string;
  sections: PolicySection[];
  backLink: string;
};

const policyByLang: Record<string, PolicyContent> = {
  he: {
    title: 'מדיניות פרטיות - BScale AI',
    lastUpdatedLabel: 'תוקף אחרון',
    lastUpdatedDate: '19.03.2026',
    sections: [
      {
        title: '1. מי אנחנו וכיצד ליצור קשר',
        paragraphs: [
          'BScale AI היא פלטפורמה לניהול ואופטימיזציית פרסום דיגיטלי, דוחות פיננסיים וניתוח נתוני חנויות מקוונות.',
          'ליצירת קשר בנושאי פרטיות ניתן לפנות אלינו בדוא"ל: support@bscale.co.il.'
        ]
      },
      {
        title: '2. איזה מידע אנו אוספים',
        paragraphs: [
          'פרטי חשבון: שם, דוא"ל, סיסמה (בצורה מגובבת בלבד), תפקיד במערכת.',
          'פרטי פרופיל ועסק: שם סוכנות/חברה, אתר, פרטי קשר נוספים שתבחר להזין.',
          'מידע מחיבורים (Google, Meta, TikTok, WooCommerce, Shopify ועוד) בהתאם להרשאות שתעניק.',
          'נתוני שימוש טכניים: כתובת IP, סוג דפדפן, שפת מערכת, עמודים בהם ביקרת ופעולות שביצעת במערכת.'
        ]
      },
      {
        title: '3. כיצד אנו משתמשים במידע',
        paragraphs: [
          'לתפעול המערכת, ניהול חשבונות ומשתמשים ומתן השירותים שביקשת.',
          'לניתוח נתוני פרסום, Analytics ומכירות חנות, והפקת תובנות והמלצות AI.',
          'לשיפור השירות, ניטור תקלות, אבטחת מידע ומניעת הונאות.',
          'לשליחת עדכונים תפעוליים, דוחות והתראות, בכפוף להגדרות ההתראות שלך.'
        ]
      },
      {
        title: '4. שיתוף מידע עם צדדים שלישיים',
        paragraphs: [
          'אנו משתפים מידע רק במידת הצורך עם ספקי שירות המסייעים לנו להפעיל את המערכת (כגון שרתי ענן, שירותי אימייל, ספקי מודלי AI ופלטפורמות הפרסום/Analytics שאתה מחבר אליהם), וכן כאשר החוק מחייב אותנו לעשות זאת.',
          'איננו מוכרים מידע אישי לצדדים שלישיים למטרות שיווק ישיר של צד שלישי.'
        ]
      },
      {
        title: '5. אבטחת מידע ושמירת נתונים',
        paragraphs: [
          'אנו נוקטים באמצעים טכניים וארגוניים סבירים להגנת המידע (הצפנת תעבורה, שמירת סיסמאות במבנה מגובב, הגבלת גישה לפי צורך ועוד).',
          'אנו שומרים מידע כל עוד חשבונך פעיל או כל עוד נדרש לעמידה בהתחייבויות משפטיות, רגולטוריות וחשבונאיות.'
        ]
      },
      {
        title: '6. זכויות משתמשים',
        paragraphs: [
          'בהתאם לדין החל (כגון חוק הגנת הפרטיות ו‑GDPR, אם רלוונטי), ייתכן שאתה זכאי לזכויות שונות, כגון גישה למידע, תיקון, מחיקה, הגבלת עיבוד, התנגדות וניידות נתונים.',
          'למימוש זכויות אלו ניתן לפנות אלינו בדוא"ל support@bscale.co.il ואנו נטפל בבקשה בהתאם לחוק.'
        ]
      },
      {
        title: '7. עוגיות (Cookies)',
        paragraphs: [
          'האתר משתמש בעוגיות לצורך תפעול טכני, שמירת סטטוס התחברות, אבטחה וניתוח שימוש.',
          'ניתן לנהל את העוגיות דרך הגדרות הדפדפן; חסימה מלאה של עוגיות עלולה לפגוע בתפקוד חלק מהפיצ\'רים במערכת.'
        ]
      },
      {
        title: '8. עדכונים למדיניות',
        paragraphs: [
          'אנו עשויים לעדכן מדיניות זו מעת לעת. תאריך העדכון האחרון מופיע בראש הדף.',
          'המשך שימושך במערכת לאחר שינוי המדיניות מהווה הסכמה לנוסח המעודכן.'
        ]
      },
      {
        title: '9. אחריות לפעולות בפלטפורמות חיצוניות',
        paragraphs: [
          'הפלטפורמה מאפשרת ביצוע פעולות (כגון עריכת קמפיינים, שינוי תקציבים, עדכון נתוני חשבון ועוד) ישירות במקורות החיצוניים המחוברים — לרבות Google Ads, Meta, TikTok וכל פלטפורמה אחרת שתחבר.',
          'הואיל ופעולות אלו משנות נתונים ממשיים בחשבונות הפרסום שלך, עליך לנהוג בזהירות ובשיקול דעת בכל פעולה שתבצע דרך המערכת.',
          'האתר bscale.co.il אינו אחראי לכל תוצאה — ישירה, עקיפה, מכוונת או בלתי מכוונת — הנובעת מפעולות שבוצעו על ידי המשתמש דרך הפלטפורמה בחשבונות הפרסום החיצוניים.'
        ]
      }
    ],
    backLink: 'חזרה לאתר'
  },
  en: {
    title: 'Privacy Policy - BScale AI',
    lastUpdatedLabel: 'Last updated',
    lastUpdatedDate: '2026-03-19',
    sections: [
      {
        title: '1. Who we are and contact details',
        paragraphs: [
          'BScale AI is a platform for managing and optimizing digital advertising, financial reports and online store data.',
          'For any privacy‑related questions, you can contact us at support@bscale.co.il.'
        ]
      },
      {
        title: '2. Information we collect',
        paragraphs: [
          'Account details: name, email address, password (stored in hashed form only), role in the system.',
          'Profile and business details: agency/company name, website, additional contact details you choose to provide.',
          'Data from connections (Google, Meta, TikTok, WooCommerce, Shopify and others) according to the permissions you grant.',
          'Technical usage data: IP address, browser type, interface language, pages visited and actions taken inside the system.'
        ]
      },
      {
        title: '3. How we use information',
        paragraphs: [
          'To operate the platform, manage accounts and users, and provide the services you request.',
          'To analyze advertising, analytics and store data and to generate AI‑based insights and recommendations.',
          'To improve the service, monitor issues, protect security and prevent fraud or abuse.',
          'To send operational updates, reports and notifications, subject to your notification settings.'
        ]
      },
      {
        title: '4. Sharing with third parties',
        paragraphs: [
          'We share information only when necessary with service providers that help us operate the platform (such as cloud hosting, email providers, AI model providers and the advertising/analytics platforms you connect), and when required by law.',
          'We do not sell personal information to third parties for their own direct marketing purposes.'
        ]
      },
      {
        title: '5. Data security and retention',
        paragraphs: [
          'We use reasonable technical and organizational measures to protect information (encrypted transport, hashed passwords, access controls and more).',
          'We retain information for as long as your account is active or as needed to comply with legal, regulatory or accounting obligations.'
        ]
      },
      {
        title: '6. Your rights',
        paragraphs: [
          'Depending on applicable law (such as local privacy law and, where relevant, the GDPR), you may have rights such as access, rectification, deletion, restriction, objection and data portability.',
          'To exercise these rights, please contact us at support@bscale.co.il and we will handle your request in accordance with the law.'
        ]
      },
      {
        title: '7. Cookies',
        paragraphs: [
          'We use cookies to support technical operation of the site, remember login state, enhance security and analyze usage.',
          'You can manage cookies through your browser settings; blocking them entirely may affect the proper functioning of some features.'
        ]
      },
      {
        title: '8. Changes to this policy',
        paragraphs: [
          'We may update this policy from time to time. The date of the latest version appears at the top of the page.',
          'Your continued use of the platform after changes means you accept the updated policy.'
        ]
      },
      {
        title: '9. Liability for actions on external platforms',
        paragraphs: [
          'The platform enables actions (such as editing campaigns, changing budgets, updating account settings and more) directly on connected external platforms — including Google Ads, Meta, TikTok and any other platform you connect.',
          'Since these actions modify real data in your advertising accounts, you must exercise caution and judgment with every action you perform through the platform.',
          'bscale.co.il is not responsible for any outcome — direct, indirect, intended or unintended — arising from actions carried out by the user through the platform on external advertising accounts.'
        ]
      }
    ],
    backLink: 'Back to site'
  },
  ru: {
    title: 'Политика конфиденциальности — BScale AI',
    lastUpdatedLabel: 'Дата обновления',
    lastUpdatedDate: '19.03.2026',
    sections: [
      {
        title: '1. Кто мы и как связаться',
        paragraphs: [
          'BScale AI — это платформа для управления и оптимизации цифровой рекламы, финансовых отчётов и данных интернет‑магазинов.',
          'По вопросам конфиденциальности вы можете написать нам на адрес support@bscale.co.il.'
        ]
      },
      {
        title: '2. Какие данные мы собираем',
        paragraphs: [
          'Данные аккаунта: имя, адрес электронной почты, пароль (хранится только в хэшированном виде), роль в системе.',
          'Профиль и данные компании: название агентства/компании, веб‑сайт, дополнительные контактные данные по вашему выбору.',
          'Информация из подключений (Google, Meta, TikTok, WooCommerce, Shopify и др.) в рамках выданных вами разрешений.',
          'Технические данные использования: IP‑адрес, тип браузера, язык интерфейса, посещённые страницы и действия в системе.'
        ]
      },
      {
        title: '3. Как мы используем данные',
        paragraphs: [
          'Для работы платформы, управления аккаунтами и предоставления запрошенных услуг.',
          'Для анализа рекламных, аналитических и торговых данных и формирования AI‑рекомендаций.',
          'Для улучшения сервиса, мониторинга сбоев, обеспечения безопасности и предотвращения мошенничества.',
          'Для отправки служебных уведомлений, отчётов и оповещений с учётом ваших настроек уведомлений.'
        ]
      },
      {
        title: '4. Передача данных третьим лицам',
        paragraphs: [
          'Мы передаём данные только при необходимости поставщикам услуг, которые помогают нам работать (облачная инфраструктура, почтовые сервисы, AI‑провайдеры, рекламные и аналитические платформы), а также если этого требует закон.',
          'Мы не продаём персональные данные третьим лицам для их прямого маркетинга.'
        ]
      },
      {
        title: '5. Безопасность и срок хранения',
        paragraphs: [
          'Мы используем разумные технические и организационные меры защиты (шифрование трафика, хэширование паролей, контроль доступа и др.).',
          'Данные хранятся, пока ваш аккаунт активен или пока это необходимо для выполнения юридических и регуляторных обязательств.'
        ]
      },
      {
        title: '6. Права пользователя',
        paragraphs: [
          'В соответствии с применимым законодательством (например, GDPR, если применимо) вы можете иметь права на доступ, исправление, удаление, ограничение обработки, возражение и переносимость данных.',
          'Для реализации прав свяжитесь с нами по адресу support@bscale.co.il — мы обработаем запрос в соответствии с требованиями закона.'
        ]
      },
      {
        title: '7. Файлы cookie',
        paragraphs: [
          'Мы используем cookie для технической работы сайта, сохранения состояния входа, безопасности и анализа использования.',
          'Вы можете управлять cookie в настройках браузера; полная блокировка может повлиять на работу отдельных функций.'
        ]
      },
      {
        title: '8. Изменения политики',
        paragraphs: [
          'Мы можем время от времени обновлять данную политику; дата последнего обновления указывается вверху страницы.',
          'Продолжая пользоваться платформой после изменений, вы соглашаетесь с обновлённой версией политики.'
        ]
      },
      {
        title: '9. Ответственность за действия на внешних платформах',
        paragraphs: [
          'Платформа позволяет выполнять действия (редактирование кампаний, изменение бюджетов, обновление настроек аккаунта и др.) непосредственно на подключённых внешних платформах — включая Google Ads, Meta, TikTok и любые другие подключённые вами платформы.',
          'Поскольку эти действия изменяют реальные данные в ваших рекламных аккаунтах, вы должны проявлять осторожность и взвешенность при каждом действии, совершаемом через платформу.',
          'bscale.co.il не несёт ответственности за какие-либо последствия — прямые, косвенные, намеренные или непреднамеренные — возникшие в результате действий пользователя на внешних рекламных аккаунтах через платформу.'
        ]
      }
    ],
    backLink: 'Назад на сайт'
  },
  pt: {
    title: 'Política de Privacidade — BScale AI',
    lastUpdatedLabel: 'Última atualização',
    lastUpdatedDate: '19/03/2026',
    sections: [
      {
        title: '1. Quem somos e contato',
        paragraphs: [
          'BScale AI é uma plataforma para gestão e otimização de publicidade digital, relatórios financeiros e dados de lojas online.',
          'Em caso de dúvidas sobre privacidade, entre em contato pelo e‑mail support@bscale.co.il.'
        ]
      },
      {
        title: '2. Informações que coletamos',
        paragraphs: [
          'Dados de conta: nome, e‑mail, senha (armazenada apenas de forma criptografada), função no sistema.',
          'Perfil e empresa: nome da agência/empresa, site e outros dados de contato fornecidos por você.',
          'Dados de integrações (Google, Meta, TikTok, WooCommerce, Shopify e outras) conforme permissões concedidas.',
          'Dados técnicos de uso: endereço IP, tipo de navegador, idioma da interface, páginas visitadas e ações realizadas.'
        ]
      },
      {
        title: '3. Como usamos as informações',
        paragraphs: [
          'Para operar a plataforma, gerenciar contas e fornecer os serviços solicitados.',
          'Para analisar dados de mídia, analytics e loja e gerar insights e recomendações baseadas em IA.',
          'Para melhorar o serviço, monitorar falhas, reforçar a segurança e prevenir fraudes.',
          'Para enviar atualizações operacionais, relatórios e notificações de acordo com suas preferências.'
        ]
      },
      {
        title: '4. Compartilhamento com terceiros',
        paragraphs: [
          'Compartilhamos dados apenas quando necessário com provedores de serviço que nos ajudam a operar a plataforma (infraestrutura em nuvem, e‑mail, provedores de modelos de IA e plataformas de mídia/analytics conectadas por você) ou quando exigido por lei.',
          'Não vendemos informações pessoais para terceiros usarem em marketing direto próprio.'
        ]
      },
      {
        title: '5. Segurança e retenção de dados',
        paragraphs: [
          'Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados (tráfego criptografado, senhas com hash, controle de acesso etc.).',
          'Mantemos os dados enquanto sua conta estiver ativa ou enquanto for necessário para cumprir obrigações legais e regulatórias.'
        ]
      },
      {
        title: '6. Seus direitos',
        paragraphs: [
          'De acordo com a legislação aplicável (incluindo, quando relevante, o GDPR), você pode ter direitos como acesso, retificação, exclusão, restrição de tratamento, oposição e portabilidade.',
          'Para exercer seus direitos, entre em contato pelo e‑mail support@bscale.co.il; trataremos sua solicitação conforme a lei.'
        ]
      },
      {
        title: '7. Cookies',
        paragraphs: [
          'Utilizamos cookies para funcionamento técnico do site, manutenção do login, segurança e análise de uso.',
          'Você pode gerenciar cookies nas configurações do navegador; o bloqueio total pode prejudicar algumas funcionalidades.'
        ]
      },
      {
        title: '8. Alterações nesta política',
        paragraphs: [
          'Podemos atualizar esta política periodicamente; a data da última versão aparece no topo da página.',
          'O uso contínuo da plataforma após alterações significa que você aceita a versão atualizada.'
        ]
      },
      {
        title: '9. Responsabilidade por ações em plataformas externas',
        paragraphs: [
          'A plataforma permite realizar ações (como editar campanhas, alterar orçamentos, atualizar configurações de conta e mais) diretamente nas plataformas externas conectadas — incluindo Google Ads, Meta, TikTok e qualquer outra plataforma que você conectar.',
          'Como essas ações modificam dados reais em suas contas de publicidade, você deve agir com cautela e julgamento em cada ação realizada por meio da plataforma.',
          'bscale.co.il não se responsabiliza por nenhum resultado — direto, indireto, intencional ou não intencional — decorrente de ações realizadas pelo usuário nas contas de publicidade externas por meio da plataforma.'
        ]
      }
    ],
    backLink: 'Voltar ao site'
  },
  fr: {
    title: 'Politique de Confidentialité — BScale AI',
    lastUpdatedLabel: 'Dernière mise à jour',
    lastUpdatedDate: '19/03/2026',
    sections: [
      {
        title: '1. Qui nous sommes et contact',
        paragraphs: [
          'BScale AI est une plateforme de gestion et d’optimisation de la publicité digitale, de rapports financiers et de données de boutiques en ligne.',
          'Pour toute question relative à la confidentialité, vous pouvez nous écrire à support@bscale.co.il.'
        ]
      },
      {
        title: '2. Données que nous collectons',
        paragraphs: [
          'Données de compte : nom, adresse e‑mail, mot de passe (stocké uniquement sous forme chiffrée), rôle dans le système.',
          'Profil et entreprise : nom de l’agence/entreprise, site web et autres coordonnées fournies par vos soins.',
          'Données provenant des intégrations (Google, Meta, TikTok, WooCommerce, Shopify, etc.) selon les autorisations que vous accordez.',
          'Données techniques d’utilisation : adresse IP, type de navigateur, langue de l’interface, pages visitées et actions effectuées.'
        ]
      },
      {
        title: '3. Utilisation des données',
        paragraphs: [
          'Pour faire fonctionner la plateforme, gérer les comptes et fournir les services demandés.',
          'Pour analyser les données publicitaires, analytiques et de boutique et générer des insights et recommandations basés sur l’IA.',
          'Pour améliorer le service, surveiller les incidents, renforcer la sécurité et prévenir la fraude.',
          'Pour envoyer des mises à jour opérationnelles, rapports et notifications conformément à vos préférences.'
        ]
      },
      {
        title: '4. Partage avec des tiers',
        paragraphs: [
          'Nous partageons des données uniquement lorsque cela est nécessaire avec des prestataires de services qui nous aident à exploiter la plateforme (hébergement cloud, services e‑mail, fournisseurs de modèles IA, plateformes de publicité/analytics que vous connectez) ou lorsque la loi l’exige.',
          'Nous ne vendons pas de données personnelles à des tiers pour leur marketing direct.'
        ]
      },
      {
        title: '5. Sécurité et durée de conservation',
        paragraphs: [
          'Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour protéger les données (chiffrement du trafic, mots de passe hachés, contrôle d’accès, etc.).',
          'Les données sont conservées tant que votre compte est actif ou aussi longtemps que nécessaire pour respecter nos obligations légales et réglementaires.'
        ]
      },
      {
        title: '6. Vos droits',
        paragraphs: [
          'Selon la législation applicable (y compris, le cas échéant, le RGPD), vous pouvez disposer de droits d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité.',
          'Pour exercer vos droits, contactez‑nous à support@bscale.co.il ; nous traiterons votre demande conformément au droit applicable.'
        ]
      },
      {
        title: '7. Cookies',
        paragraphs: [
          'Nous utilisons des cookies pour le fonctionnement technique du site, la gestion de la connexion, la sécurité et l’analyse d’utilisation.',
          'Vous pouvez gérer les cookies dans les paramètres de votre navigateur ; un blocage total peut altérer certaines fonctionnalités.'
        ]
      },
      {
        title: '8. Modifications de la politique',
        paragraphs: [
          'Nous pouvons mettre à jour cette politique de temps à autre ; la date de la dernière mise à jour figure en haut de la page.',
          'La poursuite de l’utilisation de la plateforme après modification vaut acceptation de la version mise à jour.'
        ]
      },
      {
        title: '9. Responsabilité pour les actions sur les plateformes externes',
        paragraphs: [
          'La plateforme permet d’effectuer des actions (telles que la modification de campagnes, la révision de budgets, la mise à jour de paramètres de compte, etc.) directement sur les plateformes externes connectées — notamment Google Ads, Meta, TikTok et toute autre plateforme que vous connectez.',
          'Ces actions modifiant des données réelles dans vos comptes publicitaires, vous devez faire preuve de prudence et de discernement pour chaque action effectuée via la plateforme.',
          'bscale.co.il décline toute responsabilité pour tout résultat — direct, indirect, intentionnel ou non intentionnel — découlant d’actions réalisées par l’utilisateur sur des comptes publicitaires externes via la plateforme.'
        ]
      }
    ],
    backLink: 'Retour au site'
  }
};

export function PrivacyPolicy() {
  const { language } = useLanguage();
  const content = policyByLang[language] ?? policyByLang.he;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex justify-center px-4 py-10">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{content.title}</h1>
          <p className="text-sm text-gray-500">
            {content.lastUpdatedLabel}: {content.lastUpdatedDate}
          </p>
        </header>

        {content.sections.map((section, idx) => (
          <section key={idx} className="space-y-2 text-sm leading-relaxed">
            <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}

        <footer className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center text-xs text-gray-500">
          <a href="/" className="text-indigo-600 hover:underline">
            {content.backLink}
          </a>
          <SiteLegalNotice compact className="text-[11px] sm:text-xs text-gray-500" />
        </footer>
      </div>
    </div>
  );
}

