#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
docker compose exec -T db pg_dump -U dpmone -d dpmone -Fc > "backups/dpmone-$stamp.dump"
echo "Backup created: backups/dpmone-$stamp.dump"
