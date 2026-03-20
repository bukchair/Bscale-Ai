import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn('[startup] DATABASE_URL not set — skipping prisma migrate deploy.');
    return;
  }
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

  const PORT = Number(process.env.PORT) || 3000;

  // Production: start Next.js standalone server
  const { default: next } = await import('next');
  const nextApp = next({ dev: false, dir: __dirname });
  await nextApp.prepare();
  const handler = nextApp.getRequestHandler();

  const { default: http } = await import('http');
  const server = http.createServer((req, res) => handler(req, res));

  server.listen(PORT, () => {
    console.info(`Server running on port ${PORT}`);
  });
}

startServer();
