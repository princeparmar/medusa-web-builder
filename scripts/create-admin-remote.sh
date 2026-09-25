#!/usr/bin/env bash
# Create / promote a super admin on the production PM2 host.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

die() { echo "error: $*" >&2; exit 1; }

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    case "$val" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
    esac
    export "$key=$val"
  done < "$f"
}

load_env_file "$ROOT/.deploy.env"

: "${SERVER_IP:?SERVER_IP missing}"
: "${SERVER_PASSWORD:?SERVER_PASSWORD missing}"
SERVER_USER="${SERVER_USER:-root}"
REMOTE_WEB_DIR="${REMOTE_WEB_DIR:-~/deploy/medusa-web-builder/web}"
SITE_URL="${SITE_URL:-https://app.vyaparnext.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@vyaparnext.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

[[ -n "$ADMIN_PASSWORD" ]] || die "ADMIN_PASSWORD missing in .deploy.env"

export SSHPASS="$SERVER_PASSWORD"
SSH=(sshpass -e ssh
  -o StrictHostKeyChecking=no
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
  -o ConnectTimeout=30
  "${SERVER_USER}@${SERVER_IP}"
)

EMAIL_Q="${ADMIN_EMAIL//\'/\'\\\'\'}"
PASS_Q="${ADMIN_PASSWORD//\'/\'\\\'\'}"

"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
# shellcheck disable=SC1091
[[ -s "\$HOME/.nvm/nvm.sh" ]] && . "\$HOME/.nvm/nvm.sh"

WEB_DIR=\$(eval echo "${REMOTE_WEB_DIR}")
cd "\$WEB_DIR"
[[ -f .env ]] || { echo "missing .env"; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Prefer shipped script with tsx; fall back to inline node if needed
if [[ -f scripts/create-admin-standalone.mjs ]]; then
  # Ensure prisma client exists for this schema
  npx --yes prisma@6.19.3 generate --schema packages/db/prisma/schema.prisma >/dev/null
  node scripts/create-admin-standalone.mjs '${EMAIL_Q}' '${PASS_Q}'
else
  echo "create-admin-standalone.mjs missing — redeploy first"
  exit 1
fi
REMOTE

echo "Sign in at ${SITE_URL}/admin/login"
