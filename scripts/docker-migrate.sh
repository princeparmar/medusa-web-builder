#!/bin/sh
set -e
cd "$(dirname "$0")/.."
echo "Applying database migrations..."
node scripts/db.mjs migrate deploy
echo "Migrations applied successfully."
