# למה האתר לא מעודכן? איך לתקן

## 1. וודא ש-Vercel מחובר לריפו הנכון

1. היכנס ל־**vercel.com** → הפרויקט של האתר (למשל BScale-Ai או b-scale-ai).
2. **Settings** → **Git**.
3. בדוק:
   - **Connected Git Repository**: חייב להיות `bukchair/BScale-Ai`.
   - **Production Branch**: חייב להיות `main`.

אם מחובר לריפו אחר או ל־branch אחר – לחץ **Disconnect** וחבר מחדש ל־`bukchair/BScale-Ai`, branch `main`.

---

## 2. הרץ Deploy חדש מהקומיט האחרון

1. בלשונית **Deployments**.
2. אם ה־deploy העליון **לא** מציג את הקומיט:  
   `החזרת שורת קמפיינים בתפריט וניתוב` (או `6aa3e3a`) – אז Vercel לא בנה מהגרסה העדכנית.
3. לחץ **Redeploy** על ה־deploy האחרון, או:
   - **Create Deployment** → Branch: **main** → **Deploy**.

---

## 3. פתח את הכתובת הנכונה (ללא קאש)

- ב־Vercel: בדף הפרויקט רשום **Domains** (למשל `b-scale-ai.vercel.app`).
- פתח את הכתובת הזו בדפדפן ב־**חלון פרטי (Incognito)** או עם **Ctrl+Shift+R** (רענון קשיח).

---

## 4. אם עדיין לא עובד

אם אחרי 1–3 האתר עדיין גרסה ישנה:

- שלח צילום מסך של **Vercel → Settings → Git** (חלק ה־Repository ו־Branch).
- שלח את **ה-URL המדויק** שאתה נכנס אליו לאתר.
