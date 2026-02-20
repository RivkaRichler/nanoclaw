#!/usr/bin/env tsx
/**
 * setup-token: Write CLAUDE_CODE_OAUTH_TOKEN to .env
 *
 * Usage:
 *   npm run setup-token              # auto-runs `claude setup-token`
 *   npm run setup-token -- <token>   # use token from CLI arg
 *   claude setup-token | npm run setup-token  # pipe from claude CLI
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ENV_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const envPath = path.join(process.cwd(), '.env');

function getToken(): string {
  // 1. CLI argument
  const arg = process.argv[2];
  if (arg && arg.trim()) return arg.trim();

  // 2. Stdin (piped)
  if (!process.stdin.isTTY) {
    const piped = fs.readFileSync('/dev/stdin', 'utf-8').trim();
    if (piped) return piped;
  }

  // 3. Auto-run `claude setup-token`
  try {
    const output = execSync('claude setup-token', { encoding: 'utf-8' }).trim();
    if (output) return output;
  } catch {
    // claude CLI not found or failed — handled below
  }

  console.error(
    'Error: no token provided and `claude setup-token` failed.\n' +
      'Usage:\n' +
      '  npm run setup-token -- <token>\n' +
      '  claude setup-token | npm run setup-token',
  );
  process.exit(1);
}

function updateEnv(token: string): void {
  let lines: string[] = [];

  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  }

  const keyLine = `${ENV_KEY}=${token}`;
  const idx = lines.findIndex((l) => l.trimStart().startsWith(`${ENV_KEY}=`));

  if (idx !== -1) {
    lines[idx] = keyLine;
  } else {
    // Add after any leading comments/blank lines at the top
    lines.push(keyLine);
  }

  // Trim trailing blank lines then add a single newline
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}

const token = getToken();
updateEnv(token);
console.log(`✓ ${ENV_KEY} written to .env`);
