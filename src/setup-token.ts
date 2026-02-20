/**
 * Token Setup Script
 *
 * Configures API tokens needed to run the NanoClaw agent container.
 * Writes CLAUDE_CODE_OAUTH_TOKEN and/or ANTHROPIC_API_KEY to .env
 *
 * Usage: npm run setup-token
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ENV_FILE = path.join(process.cwd(), '.env');

function readEnvRaw(): string {
  try {
    return fs.readFileSync(ENV_FILE, 'utf-8');
  } catch {
    return '';
  }
}

function getEnvValue(content: string, key: string): string | undefined {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    if (trimmed.slice(0, eqIdx).trim() !== key) continue;
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value || undefined;
  }
  return undefined;
}

function setEnvValue(content: string, key: string, value: string): string {
  const lines = content.split('\n');
  let found = false;

  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return line;
    if (trimmed.slice(0, eqIdx).trim() !== key) return line;
    found = true;
    return `${key}=${value}`;
  });

  if (!found) {
    // Remove trailing blank lines, add key, re-add one trailing newline
    while (updated.length > 0 && updated[updated.length - 1].trim() === '') {
      updated.pop();
    }
    updated.push(`${key}=${value}`);
  }

  return updated.join('\n') + '\n';
}

function mask(value: string): string {
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer.trim())));
}

async function main(): Promise<void> {
  console.log('NanoClaw Token Setup');
  console.log('====================');
  console.log('Configures API tokens passed to the agent container.\n');

  let envContent = readEnvRaw();

  const currentOAuth = getEnvValue(envContent, 'CLAUDE_CODE_OAUTH_TOKEN');
  const currentApiKey = getEnvValue(envContent, 'ANTHROPIC_API_KEY');

  console.log('Current values:');
  console.log(`  CLAUDE_CODE_OAUTH_TOKEN : ${currentOAuth ? mask(currentOAuth) : '(not set)'}`);
  console.log(`  ANTHROPIC_API_KEY       : ${currentApiKey ? mask(currentApiKey) : '(not set)'}`);
  console.log();
  console.log('Press Enter to keep existing value. Enter a new value to update.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // CLAUDE_CODE_OAUTH_TOKEN
    const oauthPrompt = currentOAuth
      ? `CLAUDE_CODE_OAUTH_TOKEN [${mask(currentOAuth)}]: `
      : 'CLAUDE_CODE_OAUTH_TOKEN (from claude.ai/settings): ';
    const oauthInput = await ask(rl, oauthPrompt);
    if (oauthInput) {
      envContent = setEnvValue(envContent, 'CLAUDE_CODE_OAUTH_TOKEN', oauthInput);
      console.log('  ✓ CLAUDE_CODE_OAUTH_TOKEN updated');
    } else if (!currentOAuth) {
      console.log('  - CLAUDE_CODE_OAUTH_TOKEN skipped');
    } else {
      console.log('  - CLAUDE_CODE_OAUTH_TOKEN unchanged');
    }

    // ANTHROPIC_API_KEY
    const apiKeyPrompt = currentApiKey
      ? `ANTHROPIC_API_KEY [${mask(currentApiKey)}]: `
      : 'ANTHROPIC_API_KEY (from console.anthropic.com, optional if using OAuth): ';
    const apiKeyInput = await ask(rl, apiKeyPrompt);
    if (apiKeyInput) {
      envContent = setEnvValue(envContent, 'ANTHROPIC_API_KEY', apiKeyInput);
      console.log('  ✓ ANTHROPIC_API_KEY updated');
    } else if (!currentApiKey) {
      console.log('  - ANTHROPIC_API_KEY skipped');
    } else {
      console.log('  - ANTHROPIC_API_KEY unchanged');
    }
  } finally {
    rl.close();
  }

  // Verify at least one token is configured
  const finalOAuth = getEnvValue(envContent, 'CLAUDE_CODE_OAUTH_TOKEN');
  const finalApiKey = getEnvValue(envContent, 'ANTHROPIC_API_KEY');

  if (!finalOAuth && !finalApiKey) {
    console.error('\n✗ At least one of CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY must be set.');
    console.error('  The agent container cannot authenticate with Claude without a token.');
    process.exit(1);
  }

  fs.writeFileSync(ENV_FILE, envContent, { mode: 0o600 });
  console.log(`\n✓ Tokens saved to .env`);

  if (!finalOAuth && finalApiKey) {
    console.log('\nNote: Using ANTHROPIC_API_KEY only. For Claude Max subscribers,');
    console.log('  set CLAUDE_CODE_OAUTH_TOKEN to use your subscription instead of API credits.');
  }
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
