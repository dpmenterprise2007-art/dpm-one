#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Install Docker Engine and Docker Compose plugin first."; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker Engine is not running."; exit 1; }
test -f .env || { echo "Copy .env.example to .env and configure production secrets plus CLOUDFLARE_TUNNEL_TOKEN."; exit 1; }
grep -q '^APP_ENV=production$' .env || { echo "Set APP_ENV=production in .env."; exit 1; }
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.' .env || { echo "Add CLOUDFLARE_TUNNEL_TOKEN to .env."; exit 1; }
if grep -Eq 'CHANGE_DB_PASSWORD|REPLACE_WITH_' .env; then echo "Replace all production placeholders in .env."; exit 1; fi
docker compose -f docker-compose.yml -f docker-compose.office.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.office.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.office.yml ps
echo "Local office test: http://localhost:3000"
echo "Public hostname after Cloudflare route: https://crm.dpmenterprise.in"
echo "Create first admin once: docker compose exec api python -m app.bootstrap_admin"
