import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn('[startup] DATABASE_URL not set — skipping prisma migrate deploy.');
    return;
  }
  // Use the locally-installed Prisma binary to avoid npx downloading a different major version.
  const prismaBin = path.resolve(__dirname, 'node_modules', '.bin', 'prisma');
  console.info('[startup] Prisma binary path:', prismaBin);
  try {
    const { existsSync } = await import('fs');
    if (!existsSync(prismaBin)) {
      console.error('[startup] Prisma binary NOT FOUND at:', prismaBin);
    }
    console.info('[startup] Running prisma migrate deploy...');
    execFileSync(prismaBin, ['migrate', 'deploy'], {
      stdio: 'pipe',
      cwd: __dirname,
      env: process.env,
    });
    console.info('[startup] Prisma migrations applied successfully.');
  } catch (err) {
    const error = err as (Error & { stdout?: Buffer; stderr?: Buffer }) | null;
    console.error('[startup] prisma migrate deploy failed:', error?.message);
    if (error?.stdout) console.error('[startup] stdout:', error.stdout.toString());
    if (error?.stderr) console.error('[startup] stderr:', error.stderr.toString());
    // Non-fatal: server continues, but DB-dependent APIs will fail until fixed.
  }
}

async function startServer() {
  await runMigrations();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Resolved once Next.js is initialized (production only).
  let nextHandler: ((req: any, res: any) => void) | null = null;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ─── Legacy OAuth routes (TikTok, Meta, Google) removed ─────────────────────
  // All OAuth flows now go through Next.js: /api/connections/[platform]/start
  // and /api/connections/[platform]/callback (src/app/api/connections/).
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── Google Ads routes removed ────────────────────────────────────────────────
  // Served by Next.js: /api/google/ads/accounts and /api/google/ads/campaigns
  // ─────────────────────────────────────────────────────────────────────────────

  app.post("/api/google/gmail/send", express.json(), async (req, res) => {
    const accessToken = req.headers.authorization?.split(" ")[1];
    const { to, subject, body } = req.body;

    if (!accessToken || accessToken === 'server-managed') {
      if (nextHandler) return nextHandler(req, res);
      return res.status(401).json({ message: "Unauthenticated." });
    }

    try {
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await axios.post(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        { raw: encodedMessage },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Gmail API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ message: error.response?.data?.error?.message || error.message });
    }
  });

  // ─── Google Analytics + Search Console routes removed ────────────────────────
  // Served by Next.js: /api/google/analytics/report and /api/google/search-console/query
  // ─────────────────────────────────────────────────────────────────────────────

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Initialize Next.js to serve API routes under src/app/api/
    const { default: next } = await import('next');
    const nextApp = next({ dev: false, dir: __dirname });
    await nextApp.prepare();
    nextHandler = nextApp.getRequestHandler();

    // Forward unhandled /api/* to Next.js (Express routes registered above take priority)
    app.all('/api/*', (req, res) => nextHandler(req, res));
    // Next.js static assets
    app.all('/_next/*', (req, res) => nextHandler(req, res));

    // Serve Vite SPA static files from 'dist'
    app.use(express.static(path.join(__dirname, "dist")));

    // Handle SPA routing: serve index.html for any unknown paths
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.info(`Server running on port ${PORT}`);
  });
}

startServer();
