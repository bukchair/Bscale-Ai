import { constants } from 'node:fs';
import { access, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const projectRoot = process.cwd();
const pagesDir = path.join(projectRoot, 'src', 'pages');
const backupPagesDir = path.join(projectRoot, 'src', '__vite_pages_for_next_build__');

async function exists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runNextBuild() {
  return new Promise((resolve, reject) => {
    const nextBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(nextBin, ['next', 'build'], {
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
      reject(new Error(`next build exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    });
  });
}

let movedPages = false;

try {
  if (await exists(pagesDir)) {
    if (await exists(backupPagesDir)) {
      throw new Error(`Temporary backup directory already exists: ${backupPagesDir}`);
    }
    await rename(pagesDir, backupPagesDir);
    movedPages = true;
    console.log('Temporarily moved src/pages for Next.js build isolation.');
  }

  await runNextBuild();
} finally {
  if (movedPages && (await exists(backupPagesDir))) {
    if (await exists(pagesDir)) {
      throw new Error(`Cannot restore src/pages because destination already exists: ${pagesDir}`);
    }
    await rename(backupPagesDir, pagesDir);
    console.log('Restored src/pages after Next.js build.');
  }
}
