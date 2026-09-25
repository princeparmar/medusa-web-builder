#!/usr/bin/env bash
# Build package catalog locally (Next standalone) and deploy via PM2. No Docker.
#
# Usage:
#   make deploy-local
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_MIGRATE="${RUN_MIGRATE:-1}"

die() { echo "error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }
log() { echo "==> $*"; }

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

need ssh
need sshpass
need tar
need pnpm

SERVER_IP="${SERVER_IP:-}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASSWORD="${SERVER_PASSWORD:-${SSHPASS:-}}"
APP_NAME="${APP_NAME:-medusa-web-builder}"
DOMAIN="${DOMAIN:-app.vyaparnext.com}"
SITE_URL="${SITE_URL:-https://${DOMAIN}}"
DEPLOY_ROOT="${DEPLOY_ROOT:-~/deploy/${APP_NAME}}"
REMOTE_WEB_DIR="${REMOTE_WEB_DIR:-${DEPLOY_ROOT}/web}"
WEB_PM2_NAME="${WEB_PM2_NAME:-${APP_NAME}-web}"
WEB_PORT="${WEB_PORT:-8020}"

[[ -n "$SERVER_IP" ]] || die "SERVER_IP missing — run make setup-server first"
[[ -n "$SERVER_PASSWORD" ]] || die "SERVER_PASSWORD missing"

export SSHPASS="$SERVER_PASSWORD"
SSH_BASE=(sshpass -e ssh
  -o StrictHostKeyChecking=no
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
  -o ConnectTimeout=30
)
SCP_BASE=(sshpass -e scp
  -o StrictHostKeyChecking=no
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
  -o ConnectTimeout=30
)
REMOTE="${SERVER_USER}@${SERVER_IP}"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/mwb-deploy.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT
export COPYFILE_DISABLE=1

TAG="local-$(date +%Y%m%d%H%M%S)"

log "Building Next.js standalone (catalog app)"
# Dummy DB URL is enough for prisma generate / next build
export DATABASE_URL="${DATABASE_URL:-postgresql://build:build@127.0.0.1:5432/build?schema=public}"
export NEXTAUTH_URL="${SITE_URL}"
export AUTH_SECRET="${AUTH_SECRET:-build-time-secret-not-used-in-prod}"

pnpm install --ignore-scripts
pnpm db:generate
pnpm --filter @mwb/web build

STANDALONE="$ROOT/apps/web/.next/standalone"
[[ -f "$STANDALONE/apps/web/server.js" ]] || die "standalone build missing apps/web/server.js"

STAGE="$WORKDIR/web-${TAG}"
mkdir -p "$STAGE"

# Standalone server + traced deps
cp -R "$STANDALONE"/. "$STAGE/"

# Static assets + public
mkdir -p "$STAGE/apps/web/.next"
cp -R "$ROOT/apps/web/.next/static" "$STAGE/apps/web/.next/static"
if [[ -d "$ROOT/apps/web/public" ]]; then
  mkdir -p "$STAGE/apps/web/public"
  cp -R "$ROOT/apps/web/public"/. "$STAGE/apps/web/public/" 2>/dev/null || true
fi

# Prisma for migrate + generate on server
mkdir -p "$STAGE/packages/db"
cp -R "$ROOT/packages/db/prisma" "$STAGE/packages/db/prisma"
cp "$ROOT/packages/db/package.json" "$STAGE/packages/db/package.json"

# Admin bootstrap script
mkdir -p "$STAGE/scripts"
cp "$ROOT/scripts/create-admin-standalone.mjs" "$STAGE/scripts/create-admin-standalone.mjs"

# Ensure prisma client engines are present in standalone (copy if traced)
PRISMA_SRC="$(find "$ROOT/node_modules/.pnpm" -path '*@prisma+client*/node_modules/.prisma/client' -type d 2>/dev/null | head -1 || true)"
if [[ -n "$PRISMA_SRC" ]]; then
  mkdir -p "$STAGE/node_modules/.prisma/client"
  cp -R "$PRISMA_SRC"/. "$STAGE/node_modules/.prisma/client/" 2>/dev/null || true
fi

tar -czf "$WORKDIR/web.tar.gz" -C "$WORKDIR" "web-${TAG}"
log "Artifact: $(du -h "$WORKDIR/web.tar.gz" | awk '{print $1}')"

log "Uploading to ${REMOTE}"
"${SSH_BASE[@]}" "$REMOTE" "mkdir -p \$(eval echo ${REMOTE_WEB_DIR}) /tmp"
"${SCP_BASE[@]}" "$WORKDIR/web.tar.gz" "$REMOTE:/tmp/mwb-web.tar.gz"

log "Installing on server"
"${SSH_BASE[@]}" "$REMOTE" bash -s <<REMOTE
set -euo pipefail
# shellcheck disable=SC1091
[[ -s "\$HOME/.nvm/nvm.sh" ]] && . "\$HOME/.nvm/nvm.sh"

WEB_DIR=\$(eval echo "${REMOTE_WEB_DIR}")
DEPLOY_ROOT=\$(eval echo "${DEPLOY_ROOT}")
STAGE="/tmp/mwb-web-extract"
rm -rf "\$STAGE"
mkdir -p "\$STAGE" "\$WEB_DIR" "\$DEPLOY_ROOT/logs"

tar -xzf /tmp/mwb-web.tar.gz -C "\$STAGE"
INNER=\$(find "\$STAGE" -mindepth 1 -maxdepth 1 -type d | head -1)

if [[ -f "\$WEB_DIR/.env" ]]; then
  cp "\$WEB_DIR/.env" /tmp/mwb-web.env.bak
fi

rsync -a --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'logs' \
  "\$INNER/" "\$WEB_DIR/"

if [[ -f /tmp/mwb-web.env.bak ]]; then
  mv /tmp/mwb-web.env.bak "\$WEB_DIR/.env"
fi

[[ -f "\$WEB_DIR/.env" ]] || { echo "ERROR: missing \$WEB_DIR/.env — run make setup-server"; exit 1; }

upsert_env() {
  local key="\$1" val="\$2" file="\$3"
  [[ -n "\$val" ]] || return 0
  if grep -q "^\${key}=" "\$file" 2>/dev/null; then
    grep -v "^\${key}=" "\$file" > "\$file.tmp"
    mv "\$file.tmp" "\$file"
  fi
  printf '%s=%s\n' "\$key" "\$val" >> "\$file"
}
upsert_env "NEXTAUTH_URL" "${SITE_URL}" "\$WEB_DIR/.env"
upsert_env "PORT" "${WEB_PORT}" "\$WEB_DIR/.env"
upsert_env "HOSTNAME" "0.0.0.0" "\$WEB_DIR/.env"
upsert_env "NODE_ENV" "production" "\$WEB_DIR/.env"

cd "\$WEB_DIR"

# Migrate using prisma from traced node_modules if available, else npx
if [[ "${RUN_MIGRATE}" == "1" ]]; then
  if [[ -f packages/db/prisma/schema.prisma ]]; then
    npx --yes prisma@6.19.3 migrate deploy --schema packages/db/prisma/schema.prisma
  fi
fi

# Refresh PM2 ecosystem
if [[ -f "\$DEPLOY_ROOT/ecosystem.config.cjs" ]]; then
  sed -e "s|__WEB_DIR__|\$WEB_DIR|g" -e "s|__LOG_DIR__|\$DEPLOY_ROOT/logs|g" \
    "\$DEPLOY_ROOT/ecosystem.config.cjs" > "\$DEPLOY_ROOT/ecosystem.config.cjs.tmp" 2>/dev/null || true
  # ecosystem already has absolute paths from setup; just reload
  pm2 startOrReload "\$DEPLOY_ROOT/ecosystem.config.cjs" --update-env
else
  pm2 delete "${WEB_PM2_NAME}" 2>/dev/null || true
  PORT=${WEB_PORT} HOSTNAME=0.0.0.0 NODE_ENV=production \
    pm2 start apps/web/server.js --name "${WEB_PM2_NAME}" --cwd "\$WEB_DIR"
fi
pm2 save
pm2 show "${WEB_PM2_NAME}" | head -20 || true

echo "Deployed. Local check:"
sleep 2
curl -sI "http://127.0.0.1:${WEB_PORT}" | head -8 || true
REMOTE

log "Live: ${SITE_URL}"
log "Health: make health"
log "Admin:  make create-admin"
