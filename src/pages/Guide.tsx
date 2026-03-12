import React from 'react';

export function Guide() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex justify-center px-4 py-10">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">מדריך הפעלה למערכת BScale AI</h1>
          <p className="text-sm text-gray-500">
            איך לעבוד צעד‑אחד‑אחר‑השני עם הממשק – מחיבור הפלטפורמות ועד שימוש ב‑AI ובדוחות.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">1. כניסה למערכת ומבנה כללי</h2>
          <p>
            נכנסים ל‑<strong>bscale.co.il</strong>. מדף הבית ניתן להתחבר למערכת או לקרוא מדריכים נוספים.
            לאחר ההתחברות תועבר למסך <strong>סקירה כללית</strong> (Dashboard) בכתובת ‎/app.
          </p>
          <p>
            בצד המסך תראה תפריט צד עם כל העמודים: סקירה כללית, רווחיות, ניהול תקציב, קמפיינים, המלצות AI,
            SEO, מעבדת יצירה, מוצרים, חיבורים, משתמשים (לאדמין) והגדרות.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">2. עמוד סקירה כללית – Dashboard</h2>
          <p>
            זהו העמוד הראשי שמרכז עבורך במבט אחד את מצב העסק:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>כרטיסים עליונים עם סך ההכנסות, הוצאות הקמפיינים ו‑ROAS/רווחיות.</li>
            <li>גרף הכנסות מול הוצאות לאורך זמן.</li>
            <li>תנועת גולשים בזמן אמת (GA4): משתמשים פעילים עכשיו וסך משתמשים בתקופה.</li>
            <li>נתוני SEO מ‑Search Console: קליקים, הופעות, מיקום ממוצע ו‑CTR.</li>
          </ul>
          <p>
            אם אחד החיבורים (Google, Meta, TikTok, WooCommerce) עדיין לא פעיל, המערכת מציגה במקום זה
            נתוני דמו כדי שלא תעבוד על מסך ריק, עד שמחברים את המקורות האמיתיים.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">3. חיבורים – Integrations</h2>
          <p>
            בעמוד <strong>חיבורים</strong> אתה מגדיר פעם אחת את כל ההתחברויות: מנועי AI, Google, Meta, TikTok,
            WooCommerce ו‑Shopify. אחרי ההגדרה – שאר העמודים משתמשים בנתונים האלו באופן אוטומטי.
          </p>
          <h3 className="text-base font-semibold mt-2">3.1 מנועי AI משותפים לכל המשתמשים</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>רק משתמש אדמין יכול לפתוח את הבועות של <strong>Gemini / OpenAI / Claude</strong>.</li>
            <li>בתוך כל מנוע מזינים <strong>API Key</strong> ובוחרים <strong>מודל ברירת מחדל</strong>.</li>
            <li>
              לאחר שמירה, החיבור נשמר ברמת החשבון הגלובלי,
              וכל המשתמשים במערכת משתמשים באותם מפתחות – ללא צורך להגדיר לכל משתמש בנפרד.
            </li>
            <li>משתמשים רגילים רואים רק סטטוס (מחובר/מנותק) ולא יכולים לערוך את המפתחות.</li>
          </ul>
          <h3 className="text-base font-semibold mt-2">3.2 Google Ecosystem</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>לוחצים על כפתור החיבור ל‑Google ונכנסים עם החשבון שמחובר ל‑Ads / GA4 / GSC.</li>
            <li>לאחר ההרשאה, מזינים:
              מספר חשבון Ads, מזהה GA4 (Measurement ID) וכתובת אתר ל‑Search Console.</li>
            <li>מכאן ואילך: הדשבורד, דוחות SEO והמלצות ה‑AI משתמשים בנתונים האלו.</li>
          </ul>
          <h3 className="text-base font-semibold mt-2">3.3 Meta / TikTok / WooCommerce / Shopify</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Meta</strong> – התחברות דרך Facebook, הזנת Ad Account ID ו‑Pixel ID.</li>
            <li><strong>TikTok</strong> – התחברות דרך TikTok Ads והזנת Advertiser ID.</li>
            <li><strong>WooCommerce</strong> – הזנת כתובת החנות, Consumer Key ו‑Consumer Secret.</li>
            <li><strong>Shopify</strong> – כתובת חנות ו‑Admin Access Token.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">4. מעבדת יצירה – Creative Lab</h2>
          <p>
            במעבדת היצירה מנועי ה‑AI מייצרים עבורך קריאייטיבים: תמונות, טקסטים וסקיצות לווידאו.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>אם החנות (WooCommerce/Shopify) מחוברת – בוחרים מוצר מהרשימה.</li>
            <li>המערכת מנקה את תיאורי המוצרים מ‑HTML ומשתמשת בהם כבסיס לפרומפט ל‑AI.</li>
            <li>בוחרים סוג יצירה: תמונה, טקסט מודעה, תסריט וידאו – ולוחצים “צור בעזרת AI”.</li>
            <li>מקבלים מספר גרסאות להצעה: ניתן לשמור, להעתיק ולהעביר לקמפיינים.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">5. קמפיינים והמלצות AI</h2>
          <h3 className="text-base font-semibold mt-1">5.1 עמוד קמפיינים</h3>
          <p>
            מציג רשימה מרוכזת של קמפיינים מ‑Google, Meta ו‑TikTok:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>שם קמפיין, סטטוס (פעיל/מושהה), תקציב, הוצאה, ROAS/CPA (לפי הנתונים הקיימים).</li>
            <li>אפשר למיין ולסנן כדי לזהות במה להתמקד.</li>
          </ul>
          <h3 className="text-base font-semibold mt-1">5.2 עמוד המלצות AI</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>ה‑AI סורק את הקמפיינים והחנות ומציג רשימת המלצות פעולה.</li>
            <li>דוגמאות: “להעלות תקציב בקמפיין מנצח”, “לעצור מודעות מפסידות”, “לנסות קריאייטיב חדש למוצר חזק”.</li>
            <li>כל המלצה מסבירה למה היא הוצעה, כדי שתבין את ההיגיון מאחוריה.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">6. SEO וניתוח חיפוש</h2>
          <p>
            חיבור ל‑Search Console ו‑Analytics מאפשר למערכת להציג:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>ביצועי ביטויי המפתח העיקריים שלך.</li>
            <li>עמודים שמקבלים הכי הרבה תנועה אורגנית.</li>
            <li>הזדמנויות לשיפור כותרות, תיאורים ותוכן.</li>
          </ul>
          <p>
            המטרה: להבין במהירות איפה להשקיע מאמץ SEO – באיזה דפים, על אילו ביטויים ואיזה שינויים כנראה יביאו את
            קפיצת המדרגה הבאה.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">7. מוצרים – WooCommerce / Shopify</h2>
          <p>
            עמוד המוצרים מסנכרן את הקטלוג מהחנות שלך:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>שם מוצר, SKU, מלאי, מחיר וקטגוריות.</li>
            <li>בחירה מהירה של מוצרים לעבודה במעבדת היצירה ובקמפיינים.</li>
          </ul>
          <p>
            כך אתה עובד תמיד על נתונים אמיתיים – לא על דוגמה כללית – וה‑AI מדבר בשפה של החנות שלך.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-gray-900">8. הגדרות, מנוי ותנאי שימוש</h2>
          <p>
            בעמוד <strong>הגדרות</strong> ניתן לעדכן פרטי פרופיל, שפה, מצב כהה/בהיר והגדרות מנוי.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>בחירת חבילה מתאימה לעסק.</li>
            <li>ניהול פרטי חיוב ופרטי יצירת קשר.</li>
            <li>אישור תנאי שימוש ומדיניות פרטיות לפני רכישה, כדי לעמוד בדרישות רגולציה.</li>
          </ul>
          <p>
            למנהלי מערכת (אדמין) יש גם אזור נפרד להגדרת טוקן סליקה גלובלי – נסתר מהמשתמשים הרגילים.
          </p>
        </section>

        <footer className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <a href="/" className="text-indigo-600 hover:underline">חזרה לדף הבית</a>
          <span>BScale AI © {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}

