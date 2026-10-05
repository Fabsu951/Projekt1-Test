# Publishes the latest Turkoll: pulls from GitHub, updates the worker
# (database migrations + code) and the website. Run from anywhere:
#
#   powershell -ExecutionPolicy Bypass -File "C:\Users\fabia\Documents\fjallvarning-repo\Svenska laviner\deploy.ps1"
#
# Stops at the first step that fails, so nothing is half-published silently.
# Saved as UTF-8 with BOM so Windows PowerShell 5.1 shows å, ä and ö correctly.

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$worker = Join-Path $PSScriptRoot "worker"
$app = Join-Path $PSScriptRoot "app"

function Step($title, [scriptblock]$action) {
  Write-Host ""
  Write-Host "=== $title ===" -ForegroundColor Cyan
  & $action
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Steget '$title' misslyckades (felkod $LASTEXITCODE). Inget mer har publicerats." -ForegroundColor Red
    exit 1
  }
}

Step "Hämtar senaste koden" { git -C $repo pull }
Step "Installerar workerns paket" { Set-Location $worker; npm install }
Step "Uppdaterar databasen" { Set-Location $worker; npx wrangler d1 migrations apply fjallkoll --remote }
Step "Publicerar workern" { Set-Location $worker; npx wrangler deploy }
Step "Aktiverar notiser (bara första gången)" { Set-Location $worker; node scripts/setup-push.mjs }
Step "Installerar appens paket" { Set-Location $app; npm install }
Step "Bygger sajten" {
  Set-Location $app
  $env:VITE_MAP_PROXY_URL = "https://fjallkoll-worker.fabian-n-sund.workers.dev"
  npm run build
}
Step "Publicerar sajten" {
  Set-Location $app
  npx wrangler pages deploy dist --project-name=fjallkoll --branch=production --commit-dirty=true
}

Write-Host ""
Write-Host "Klart! Version: $(git -C $repo log --oneline -1)" -ForegroundColor Green
Write-Host "Öppna https://fjallkoll.pages.dev och tryck Ctrl+Shift+R."
