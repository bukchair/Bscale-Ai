# חיבור הפרויקט ל-GitHub

## שלב 1: צור ריפו ב-GitHub

1. היכנס ל-**https://github.com** והתחבר.
2. לחץ על **"+"** (פינה ימנית עליונה) → **New repository**.
3. **Repository name:** בחר שם (למשל `bscale-ai`).
4. השאר **Public**, **אל** תסמן "Add a README file".
5. לחץ **Create repository**.

---

## שלב 2: הרשאות ל-Git (אחת מהאפשרויות)

### אופציה א – HTTPS + Token (פשוט להתחלה)

1. ב-GitHub: **Settings** (פרופיל) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. **Generate new token (classic)**. תן שם (למשל "Cursor"), סמן **repo**.
3. **Generate token** והעתק את ה-Token (תראה אותו רק פעם אחת).
4. בטרמינל בפרויקט הרץ (החלף `YOUR_USERNAME`, `YOUR_REPO`, `YOUR_TOKEN`):

```powershell
cd "c:\Users\User\Downloads\בי סקייל"
git remote add origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin master
```

**דוגמה:** משתמש `david`, ריפו `bscale-ai`, Token `ghp_xxxx...`
```powershell
git remote add origin https://ghp_xxxx@github.com/david/bscale-ai.git
git push -u origin master
```

אחרי הדחיפה הראשונה אפשר להסיר את ה-Token מה-URL (למען האבטחה) ולהשתמש ב-Credential Manager:
```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```
בדחיפה הבאה Windows יבקש מהתחברות (או ישתמש ב-Token ששמרת).

---

### אופציה ב – GitHub CLI (נוח אחרי התקנה)

1. התקן: **https://cli.github.com**
2. בטרמינל:
```powershell
gh auth login
```
עקוב אחרי ההנחיות (בדפדפן).
3. אחרי ההתחברות:
```powershell
cd "c:\Users\User\Downloads\בי סקייל"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin master
```

---

### אופציה ג – SSH

1. צור מפתח SSH (אם אין):
```powershell
ssh-keygen -t ed25519 -C "your_email@example.com" -f "$env:USERPROFILE\.ssh\id_ed25519" -N ""
```
2. הצג את המפתח הציבורי והדבק ב-GitHub:
```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```
ב-GitHub: **Settings** → **SSH and GPG keys** → **New SSH key** → הדבק ושמור.
3. חבר את הריפו עם SSH ודחוף:
```powershell
cd "c:\Users\User\Downloads\בי סקייל"
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin master
```

---

## שלב 3: וידוא

- בדף הריפו ב-GitHub אמורים להופיע כל הקבצים.
- מעכשיו אפשר לעדכן ולדחוף עם:
```powershell
npm run push
```
או:
```powershell
git add -A
git commit -m "העדכון שלי"
git push
```

---

## אם כבר הוספת remote אבל בלי Token

אם הרצת רק:
```powershell
git remote add origin https://github.com/USER/REPO.git
```
בפעם הראשונה שתריץ `git push` Windows יכול להציג חלון התחברות ל-GitHub – התחבר שם (או הזן Token כ-Security password). אם לא מופיע חלון, השתמש באופציה א (Token בתוך ה-URL פעם אחת) או ב-GitHub CLI.
