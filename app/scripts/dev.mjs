#!/usr/bin/env node
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const binDir = resolve(root, 'node_modules/.bin');

const port = process.env.DEV_PORT || '1420';
const config = JSON.stringify({ build: { devUrl: `http://localhost:${port}` } });
const env = { ...process.env, PATH: `${binDir}:${process.env.PATH}` };

try {
  execSync('npm run sidecar:build', { stdio: 'inherit', cwd: root });
  execSync(`tauri dev --config '${config}'`, { stdio: 'inherit', cwd: root, env });
} catch (e) {
  process.exit(e.status || 1);
}
