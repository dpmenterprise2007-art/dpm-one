$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "DPM ONE - Office Self-Hosted Deployment" -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is not installed. Install Docker Desktop for Windows, enable WSL 2, reboot, and rerun this script."
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Engine is not running. Start Docker Desktop and rerun this script." }

if (-not (Test-Path ".env")) {
  throw "Missing .env. Copy .env.example to .env, set APP_ENV=production, unique DB/JWT/admin passwords and CLOUDFLARE_TUNNEL_TOKEN, then rerun."
}
$envText = Get-Content ".env" -Raw
foreach ($placeholder in @("CHANGE_DB_PASSWORD","REPLACE_WITH_A_LONG_RANDOM_SECRET","REPLACE_WITH_A_UNIQUE_PASSWORD","CLOUDFLARE_TUNNEL_TOKEN=")) {
  if ($placeholder -ne "CLOUDFLARE_TUNNEL_TOKEN=" -and $envText.Contains($placeholder)) {
    throw "Production placeholder detected in .env: $placeholder. Replace it before deployment."
  }
}
if ($envText -notmatch "(?m)^APP_ENV=production\s*$") { throw "Set APP_ENV=production in .env." }
if ($envText -notmatch "(?m)^CLOUDFLARE_TUNNEL_TOKEN=\S+") { throw "Add the named Cloudflare Tunnel token to .env. Do not paste it into chat or GitHub." }
if ($envText -match "(?m)^JWT_SECRET_KEY=.{0,40}\s*$") { throw "JWT_SECRET_KEY must be a long random secret (at least 64 characters)." }

Write-Host "Validating Compose configuration..." -ForegroundColor Yellow
docker compose -f docker-compose.yml -f docker-compose.office.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw "Docker Compose configuration validation failed." }

Write-Host "Building and starting DPM ONE..." -ForegroundColor Yellow
docker compose -f docker-compose.yml -f docker-compose.office.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "DPM ONE startup failed. Check: docker compose -f docker-compose.yml -f docker-compose.office.yml logs" }

Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 12
docker compose -f docker-compose.yml -f docker-compose.office.yml ps
Write-Host ""
Write-Host "DPM ONE containers have been started." -ForegroundColor Green
Write-Host "Local office test: http://localhost:3000"
Write-Host "Public hostname after the Cloudflare route is configured: https://crm.dpmenterprise.in"
Write-Host "Create the first admin once: docker compose exec api python -m app.bootstrap_admin"
Write-Host "Do not expose database port 5432 or API port 8000 to the Internet."
