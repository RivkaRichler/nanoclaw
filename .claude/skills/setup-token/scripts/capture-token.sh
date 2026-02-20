#!/bin/bash
set -euo pipefail

# capture-token.sh — Extract Claude OAuth token from local Claude Code installation
#
# Outputs a structured status block:
#   STATUS=ok           Token captured in TOKEN variable
#   STATUS=not_found    claude CLI not installed
#   STATUS=not_logged_in claude CLI installed but not authenticated
#   STATUS=manual_needed claude setup-token failed for unknown reason
#
# Usage:
#   capture-token.sh              # Capture token and write to .env
#   capture-token.sh --verify-only # Just verify credentials exist

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/setup.log"
VERIFY_ONLY="${1:-}"

mkdir -p "$PROJECT_ROOT/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [capture-token] $*" >> "$LOG_FILE"; }

log "Starting token capture (verify_only=$VERIFY_ONLY)"

# --verify-only mode: just check .env and data/env/env
if [ "$VERIFY_ONLY" = "--verify-only" ]; then
  ENV_FILE="$PROJECT_ROOT/.env"
  CONTAINER_ENV="$PROJECT_ROOT/data/env/env"
  CRED_TYPE="none"
  SYNCED="false"

  if [ -f "$ENV_FILE" ]; then
    if grep -qE "^CLAUDE_CODE_OAUTH_TOKEN=.+" "$ENV_FILE"; then
      CRED_TYPE="oauth"
    elif grep -qE "^ANTHROPIC_API_KEY=.+" "$ENV_FILE"; then
      CRED_TYPE="api_key"
    fi
  fi

  if [ -f "$CONTAINER_ENV" ]; then
    if grep -qE "^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)=.+" "$CONTAINER_ENV"; then
      SYNCED="true"
    fi
  fi

  log "Verify: CRED_TYPE=$CRED_TYPE SYNCED=$SYNCED"
  cat <<EOF
=== NANOCLAW SETUP: VERIFY_TOKEN ===
CRED_TYPE: $CRED_TYPE
SYNCED: $SYNCED
STATUS: ok
=== END ===
EOF
  exit 0
fi

# Check if claude CLI is available
if ! command -v claude >/dev/null 2>&1; then
  log "claude CLI not found in PATH"
  cat <<EOF
=== NANOCLAW SETUP: CAPTURE_TOKEN ===
STATUS: not_found
MESSAGE: claude CLI not installed or not in PATH
=== END ===
EOF
  exit 0
fi

log "claude CLI found at: $(which claude)"

# Try to extract token via claude setup-token
# The command outputs the OAuth token (sk-ant-oat01-...) to stdout
TOKEN_OUTPUT=""
EXIT_CODE=0
TOKEN_OUTPUT=$(claude setup-token 2>/tmp/claude-setup-token-err.txt) || EXIT_CODE=$?
STDERR_OUTPUT=$(cat /tmp/claude-setup-token-err.txt 2>/dev/null || echo "")
rm -f /tmp/claude-setup-token-err.txt

log "claude setup-token exit_code=$EXIT_CODE output_length=${#TOKEN_OUTPUT}"

if [ $EXIT_CODE -ne 0 ]; then
  # Check if it's a login issue
  if echo "$STDERR_OUTPUT$TOKEN_OUTPUT" | grep -qiE "(not logged|login|authenticate|unauthorized|sign in)"; then
    log "Not logged in: $STDERR_OUTPUT"
    cat <<EOF
=== NANOCLAW SETUP: CAPTURE_TOKEN ===
STATUS: not_logged_in
MESSAGE: claude CLI is installed but not logged in
=== END ===
EOF
  else
    log "Unknown failure: stderr=$STDERR_OUTPUT"
    cat <<EOF
=== NANOCLAW SETUP: CAPTURE_TOKEN ===
STATUS: manual_needed
MESSAGE: claude setup-token failed (exit $EXIT_CODE): $STDERR_OUTPUT
=== END ===
EOF
  fi
  exit 0
fi

# Extract token from output - it should be a sk-ant-oat token
# Try to find the token pattern directly
TOKEN=$(echo "$TOKEN_OUTPUT" | grep -oE 'sk-ant-oat[0-9A-Za-z_-]+' | head -1 || echo "")

if [ -z "$TOKEN" ]; then
  # Maybe the entire output is the token (some versions output just the token)
  TRIMMED=$(echo "$TOKEN_OUTPUT" | tr -d '[:space:]')
  if echo "$TRIMMED" | grep -qE '^sk-ant-'; then
    TOKEN="$TRIMMED"
  fi
fi

if [ -z "$TOKEN" ]; then
  log "Could not extract token from output: $TOKEN_OUTPUT"
  cat <<EOF
=== NANOCLAW SETUP: CAPTURE_TOKEN ===
STATUS: manual_needed
MESSAGE: Could not parse token from claude setup-token output
=== END ===
EOF
  exit 0
fi

log "Token captured successfully (length=${#TOKEN})"

# Write to .env — add or replace CLAUDE_CODE_OAUTH_TOKEN
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  # Remove any existing Claude auth lines
  TEMP_ENV=$(mktemp)
  grep -vE "^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)=" "$ENV_FILE" > "$TEMP_ENV" || true
  echo "CLAUDE_CODE_OAUTH_TOKEN=$TOKEN" >> "$TEMP_ENV"
  mv "$TEMP_ENV" "$ENV_FILE"
  log "Updated existing .env with token"
else
  echo "CLAUDE_CODE_OAUTH_TOKEN=$TOKEN" > "$ENV_FILE"
  log "Created new .env with token"
fi

cat <<EOF
=== NANOCLAW SETUP: CAPTURE_TOKEN ===
STATUS: ok
TOKEN: $TOKEN
ENV_FILE: $ENV_FILE
=== END ===
EOF
