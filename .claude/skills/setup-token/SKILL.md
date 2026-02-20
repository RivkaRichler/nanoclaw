---
name: setup-token
description: Configure Claude authentication for NanoClaw. Automatically captures the Claude OAuth token from the local Claude Code installation and writes it to .env. Also supports manual Anthropic API key entry. Use when setting up credentials for the first time, reconfiguring auth, or when the agent reports "Invalid API key".
---

# Setup Claude Token

Configure Claude authentication for the NanoClaw agent container. The container needs either a Claude subscription OAuth token or an Anthropic API key to run Claude Code inside.

## 1. Check Existing Credentials

Read `.env` if it exists. Look for `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY`.

- If either is set, confirm with user: "You already have Claude credentials configured (`<TYPE>`). Want to keep them or reconfigure?"
- If keeping: jump to step 4 (sync to container) to make sure they're synced.
- If reconfiguring or nothing exists: continue to step 2.

## 2. Choose Auth Method

AskUserQuestion: How do you access Claude?

- **Claude subscription (Pro/Max)** — Uses your existing Claude.ai subscription. No usage costs beyond the subscription. Recommended if you have Pro or Max.
- **Anthropic API key (pay-per-use)** — Billed per token. Use if you don't have a subscription or prefer API access.

## 3. Configure Credentials

### Option A: Claude Subscription (OAuth Token)

Run the capture script to extract the token automatically:

```bash
./.claude/skills/setup-token/scripts/capture-token.sh
```

Parse the status block:

**If STATUS=ok:**
- `TOKEN` contains the OAuth token
- Write it to `.env`: add or replace `CLAUDE_CODE_OAUTH_TOKEN=<token>`
- Tell user: "Token captured and saved to `.env` automatically."
- Continue to step 4.

**If STATUS=not_logged_in:**
- Tell user:

  > Claude Code isn't logged in on this machine. Please open a terminal and run:
  > ```
  > claude
  > ```
  > Complete the login flow (browser will open). Once logged in, let me know.

- After user confirms, re-run the capture script. If it still fails, fall back to manual path below.

**If STATUS=not_found:**
- Tell user:

  > The `claude` CLI wasn't found. It's included with Claude Code (claude.ai/code). Once installed, open a terminal, run `claude` to log in, then let me know.

- After user confirms installation and login, re-run the capture script.

**If STATUS=manual_needed:**
- Tell user:

  > Please open another terminal and run:
  > ```
  > claude setup-token
  > ```
  > Copy the token it outputs (starts with `sk-ant-oat`). Then add this line to the `.env` file in the project root:
  > ```
  > CLAUDE_CODE_OAUTH_TOKEN=<paste-token-here>
  > ```
  > Let me know when done.

- After confirmation, verify `.env` has `CLAUDE_CODE_OAUTH_TOKEN`.

### Option B: Anthropic API Key

Tell user:

> Please add this line to the `.env` file in the project root:
> ```
> ANTHROPIC_API_KEY=sk-ant-api03-...
> ```
> You can get a key from https://console.anthropic.com/settings/keys
> Let me know when done.

After user confirms, read `.env` and verify `ANTHROPIC_API_KEY` is present and non-empty.

## 4. Sync to Container

The container reads credentials from `data/env/env`, not `.env` directly (Apple Container limitation — env vars are lost with `-i` flag).

```bash
mkdir -p data/env && cp .env data/env/env
```

Tell user: "Credentials synced to container environment."

## 5. Verify

Confirm the credential is present and looks valid:

```bash
./.claude/skills/setup-token/scripts/capture-token.sh --verify-only
```

Or manually:

```bash
grep -E "^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)=" .env
```

Report to user:
- What credential type was found (OAuth token or API key)
- Whether `data/env/env` was updated

If NanoClaw is already running, restart it to pick up the new credentials:

```bash
# macOS
launchctl kickstart -k gui/$(id -u)/com.nanoclaw 2>/dev/null || true

# Linux
systemctl --user restart nanoclaw 2>/dev/null || true
```

## Troubleshooting

**"Invalid API key · Please run /login"** in container logs:
- The credential in `data/env/env` is missing or wrong
- Re-run this skill to recapture and sync

**OAuth token expired:**
- Claude OAuth tokens can expire. Re-run this skill to get a fresh token.
- Run `claude setup-token` in a terminal to check if the token is still valid.

**API key rejected:**
- Verify the key at https://console.anthropic.com/settings/keys
- Make sure there's no extra whitespace in `.env`
