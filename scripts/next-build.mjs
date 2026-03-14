import { constants } from 'node:fs';
import { access, readFile, rename, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const projectRoot = process.cwd();
const pagesDir = path.join(projectRoot, 'src', 'pages');
const backupPagesDir = path.join(projectRoot, 'src', '__vite_pages_for_next_build__');
const appEntryPath = path.join(projectRoot, 'src', 'App.tsx');

async function exists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runNextBuild() {
  return runCommand('next', ['build']);
}

function runPrismaGenerate() {
  return runCommand('prisma', ['generate']);
}

function runPrismaMigrateDeploy() {
  return runCommand('prisma', ['migrate', 'deploy']);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const nextBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(nextBin, [command, ...args], {
      stdio: 'inherit',
      cwd: projectRoot,
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    });
  });
}

let movedPages = false;
let rewroteAppImports = false;
let originalAppSource = '';

try {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for production build/deploy.');
  }

  if (process.env.DATABASE_URL) {
    console.log('Applying Prisma migrations (deploy)...');
    await runPrismaMigrateDeploy();
  } else {
    console.log('DATABASE_URL not set; skipping prisma migrate deploy.');
  }

  console.log('Generating Prisma Client for Next.js runtime...');
  await runPrismaGenerate();

  if (await exists(pagesDir)) {
    if (await exists(backupPagesDir)) {
      throw new Error(`Temporary backup directory already exists: ${backupPagesDir}`);
    }
    await rename(pagesDir, backupPagesDir);
    movedPages = true;
    console.log('Temporarily moved src/pages for Next.js build isolation.');

    originalAppSource = await readFile(appEntryPath, 'utf8');
    const rewrittenAppSource = originalAppSource.replaceAll(
      "./pages/",
      "./__vite_pages_for_next_build__/"
    );

    if (rewrittenAppSource !== originalAppSource) {
      await writeFile(appEntryPath, rewrittenAppSource, 'utf8');
      rewroteAppImports = true;
      console.log('Temporarily rewired App.tsx imports for Next.js build.');
    }
  }

  await runNextBuild();
} finally {
  if (rewroteAppImports) {
    await writeFile(appEntryPath, originalAppSource, 'utf8');
    console.log('Restored App.tsx imports after Next.js build.');
  }

  if (movedPages && (await exists(backupPagesDir))) {
    if (await exists(pagesDir)) {
      throw new Error(`Cannot restore src/pages because destination already exists: ${pagesDir}`);
    }
    await rename(backupPagesDir, pagesDir);
    console.log('Restored src/pages after Next.js build.');
  }
}
