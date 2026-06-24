#!/usr/bin/env bash
# Publish ecosystem packages via GitHub Actions (no local npm publish required).
#
# Prerequisites:
#   - gh CLI authenticated (gh auth login)
#   - Local clones pushed to main (workflows publish from remote main)
#
# Usage:
#   pnpm publish:ecosystem
#   FRAMEWORK_REPO=SmartByteLabs/storefront-framework pnpm publish:ecosystem
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FRAMEWORK_REPO="${FRAMEWORK_REPO:-SmartByteLabs/storefront-framework}"
COMPONENTS_REPO="${COMPONENTS_REPO:-princeparmar/storefront-components}"
PLUGINS_REPO="${PLUGINS_REPO:-SmartByteLabs/medusa-plugins}"

FRAMEWORK_PATH="${STOREFRONT_FRAMEWORK_PATH:-$HOME/git/personal/storefront-framework}"
COMPONENTS_PATH="${COMPONENTS_PATH:-$HOME/git/ecommerce/storefront-components}"
PLUGINS_PATH="${MEDUSA_PLUGINS_PATH:-$HOME/git/ecommerce/medusa-plugins}"

WATCH="${PUBLISH_WATCH:-1}"

trigger_release() {
  local repo="$1"
  local label="$2"
  echo ""
  echo "==> $label ($repo)"
  if ! gh workflow run release.yml --repo "$repo"; then
    echo "FAILED to trigger release.yml on $repo" >&2
    return 1
  fi
  echo "Triggered release.yml"
  if [ "$WATCH" = "1" ]; then
    sleep 3
    local run_id
    run_id=$(gh run list --repo "$repo" --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
    if [ -n "$run_id" ] && [ "$run_id" != "null" ]; then
      echo "Watching run $run_id ..."
      gh run watch "$run_id" --repo "$repo" --exit-status || echo "WARN: release workflow failed — check logs on GitHub"
    fi
  fi
}

plugin_dir_name() {
  local pkg_path="$1"
  basename "$(dirname "$pkg_path")"
}

publish_plugin_if_new() {
  local dir="$1"
  local name version published plugin_dir
  name=$(node -p "require('$dir/package.json').name")
  version=$(node -p "require('$dir/package.json').version")
  published=$(npm view "$name" version 2>/dev/null || echo "")
  if [ -z "$published" ]; then
    echo "  PUBLISH $name@$version (not on npm) via workflow"
  elif [ "$version" = "$published" ]; then
    echo "  SKIP $name@$version (npm up to date)"
    return 0
  elif [ "$(printf '%s\n' "$version" "$published" | sort -V | tail -1)" != "$version" ]; then
    echo "  SKIP $name@$version (local behind npm@$published — pull/rebase main)"
    return 0
  else
    echo "  PUBLISH $name@$version (npm: $published) via workflow"
  fi
  plugin_dir=$(plugin_dir_name "$dir/package.json")
  if ! gh workflow run publish-plugin.yml --repo "$PLUGINS_REPO" -f "plugin_name=$plugin_dir"; then
    echo "  FAILED to trigger publish for $plugin_dir" >&2
    return 1
  fi
}

echo "Publishing via GitHub Actions workflows"
echo "  framework:  $FRAMEWORK_REPO"
echo "  components: $COMPONENTS_REPO"
echo "  plugins:    $PLUGINS_REPO"

trigger_release "$FRAMEWORK_REPO" "storefront-framework"
trigger_release "$COMPONENTS_REPO" "storefront-components"

echo ""
echo "==> medusa-plugins (per-plugin publish-plugin.yml)"
if [ ! -d "$PLUGINS_PATH" ]; then
  echo "WARN: MEDUSA_PLUGINS_PATH not found: $PLUGINS_PATH" >&2
else
  for dir in "$PLUGINS_PATH"/*/; do
    [ -f "$dir/package.json" ] || continue
    publish_plugin_if_new "$dir" || true
  done
  if [ "$WATCH" = "1" ]; then
    echo ""
    echo "Plugin workflows triggered — latest runs:"
    gh run list --repo "$PLUGINS_REPO" --workflow=publish-plugin.yml --limit 5
  fi
fi

echo ""
echo "Done. After workflows succeed, sync MWB registry versions:"
echo "  pnpm sync:registry-versions"
