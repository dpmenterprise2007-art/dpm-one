$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force -Path "backups" | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path "backups" "dpmone-$stamp.sql"
docker compose exec -T db pg_dump -U dpmone -d dpmone -Fp | Out-File -Encoding utf8 $file
if ($LASTEXITCODE -ne 0) { throw "Database backup failed." }
Write-Host "Backup created: $file" -ForegroundColor Green
