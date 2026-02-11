#!/usr/bin/env node
import { execSync } from 'child_process';

const port = process.env.DEV_PORT || '1420';
const config = JSON.stringify({ build: { devUrl: `http://localhost:${port}` } });

try {
  execSync('npm run sidecar:build', { stdio: 'inherit' });
  execSync(`npm run tauri -- dev --config '${config}'`, { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
