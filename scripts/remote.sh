#!/usr/bin/env bash
# Run a remote command (or open an interactive SSH shell) using .deploy.env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

: "${SERVER_IP:?SERVER_IP missing in .deploy.env}"
: "${SERVER_PASSWORD:?SERVER_PASSWORD missing in .deploy.env}"
SERVER_USER="${SERVER_USER:-root}"
WEB_PORT="${WEB_PORT:-8020}"
DEPLOY_ROOT="${DEPLOY_ROOT:-~/deploy/medusa-web-builder}"

export SSHPASS="$SERVER_PASSWORD"
SSH=(sshpass -e ssh
  -o StrictHostKeyChecking=no
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
  -o ConnectTimeout=30
  "${SERVER_USER}@${SERVER_IP}"
)

NVM_BOOT='[[ -s "$HOME/.nvm/nvm.sh" ]] && . "$HOME/.nvm/nvm.sh"'
DEPLOY_BOOT="cd \$(eval echo ${DEPLOY_ROOT})"

if [[ $# -eq 0 ]]; then
  exec "${SSH[@]}" -t "bash -lc '$NVM_BOOT; $DEPLOY_BOOT; exec bash -l'"
else
  exec "${SSH[@]}" "bash -lc '$NVM_BOOT; $DEPLOY_BOOT; export WEB_PORT=${WEB_PORT}; $*'"
fi
