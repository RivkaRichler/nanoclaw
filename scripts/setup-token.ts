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

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(''));
    // Timeout: if nothing arrives in 500ms, give up
    setTimeout(() => resolve(data.trim()), 500);
  });
}

function runClaudeSetupToken(): string {
  // Unset CLAUDECODE so the CLI doesn't refuse to run inside a Claude Code session
  const env = { ...process.env };
  delete env['CLAUDECODE'];
  try {
    return execSync('claude setup-token', {
      encoding: 'utf-8',
      env,
      timeout: 15000,
      input: '', // don't block waiting for stdin
    }).trim();
  } catch {
    return '';
  }
}

async function getToken(): Promise<string> {
  // 1. CLI argument
  const arg = process.argv[2];
  if (arg?.trim()) return arg.trim();

  // 2. Stdin (piped) — with timeout so we don't block if nothing is piped
  if (!process.stdin.isTTY) {
    const piped = await readStdin();
    if (piped) return piped;
  }

  // 3. Auto-run `claude setup-token`
  const output = runClaudeSetupToken();
  if (output) return output;

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
    lines.push(keyLine);
  }

  // Trim trailing blank lines then add a single newline
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}

const token = await getToken();
updateEnv(token);
console.log(`✓ ${ENV_KEY} written to .env`);
