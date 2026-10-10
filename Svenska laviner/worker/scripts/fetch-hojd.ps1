# Gör den detaljerade lutningskartan ("Lutning, detaljerad" i appen) av
# Lantmäteriets höjdmodell "Markhöjdmodell Nedladdning, grid 1+": hittar
# höjdrutorna för fjällområdena i Lantmäteriets STAC-API och låter
# import-slope.ts räkna lutningen och ladda upp kartrutorna till R2. Kräver
# att Geotorget-kontot har behörighet till produkten (ansök på Geotorget).
#
# Cloud sessions can't reach api.lantmateriet.se, so run this locally:
#
#   cd "Svenska laviner\worker"
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-hojd.ps1              # visa bara vad som finns
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-hojd.ps1 -DryRun      # provkör några områden, inget laddas upp
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-hojd.ps1 -Import      # räkna och ladda upp allt
#   ... -Import -Skip 1200                                                         # fortsätt en avbruten import
#   ... -Box norra                                                                 # bara ett område (norra, mitten, sodra)
#   ... -Collection <id>                                                           # om samlingen inte hittas själv
#   ... -Base https://api.lantmateriet.se/<annat-api>/v1                           # om höjddatan ligger i ett annat API
#
# Höjdrutorna läses direkt från Lantmäteriet med delhämtning, så inget stort
# sparas på datorn. Inloggningen frågas efter varje gång och sparas aldrig.
# Filen stac-items-hojd.json innehåller inga lösenord.

param(
  [switch]$DryRun,
  [switch]$Import,
  [int]$Skip = 0,
  [string]$Box = "",
  [string]$Collection = "",
  [string]$Base = "https://api.lantmateriet.se/stac-hojd/v1",
  [string]$OutDir = (Join-Path $env:USERPROFILE "Downloads\hojd")
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
if ($Import -and $DryRun) { Write-Host "Välj -DryRun eller -Import, inte båda." ; exit 1 }
$ua = "Snolage-lutning"

# Same boxes as MOUNTAIN_BOXES in src/gpkgTiles.ts.
$boxes = [ordered]@{
  "norra"  = @(16.85, 67.43, 20.51, 68.72)
  "mitten" = @(13.77, 64.70, 16.43, 66.35)
  "sodra"  = @(11.65, 62.11, 14.20, 63.94)
}
if ($Box -and -not $boxes.Contains($Box)) { Write-Host "Okänt område $Box. Välj norra, mitten eller sodra." ; exit 1 }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$cred = Get-Credential -Message "Logga in med ditt Geotorget-konto (e-post och lösenord)"
if (-not $cred) { Write-Host "Avbrutet." ; exit 1 }
$pair = "{0}:{1}" -f $cred.UserName, $cred.GetNetworkCredential().Password
$headers = @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair)) }
$pair = $null

function Get-Json($url) {
  try {
    $res = Invoke-WebRequest -Uri $url -Headers $headers -UserAgent $ua -TimeoutSec 120 -UseBasicParsing
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401 -or $code -eq 403) {
      Write-Host "Inloggningen godtogs inte ($code). Kontrollera e-post/lösenord och att du har fått behörighet till Markhöjdmodell på Geotorget." -ForegroundColor Red
      exit 1
    }
    if ($code -eq 404) {
      Write-Host "Hittade inget på $url. Ligger höjddatan i ett annat API? Prova -Base med adressen från Geotorget." -ForegroundColor Red
      exit 1
    }
    throw
  }
  $text = [Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
  return @{ Text = $text; Json = ($text | ConvertFrom-Json) }
}

function Next-Link($json) {
  foreach ($l in @($json.links)) { if ($l.rel -eq "next" -and $l.href) { return $l.href } }
  return $null
}

# ---- 1. Which collection holds the height model ----
Write-Host "Hämtar katalogen från $Base ..."
$cols = Get-Json "$Base/collections"
$cols.Text | Set-Content -Encoding UTF8 (Join-Path $OutDir "stac-collections-hojd.json")
Write-Host "Samlingar i API:et:"
foreach ($c in @($cols.Json.collections)) { Write-Host ("  {0}  –  {1}" -f $c.id, $c.title) }

if (-not $Collection) {
  $hits = @($cols.Json.collections | Where-Object {
      $t = "$($_.id) $($_.title)"
      ($t -match "markh|höjdmodell|hojdmodell|grid") -and ($t -match "1\+|grid1|grid-1|1 m|1m") -and ($t -notmatch "visning|50")
    })
  if ($hits.Count -ne 1) {
    Write-Host ""
    Write-Host "Kunde inte välja samling automatiskt ($($hits.Count) träffar). Kör igen med -Collection <id> från listan ovan (den med Markhöjdmodell grid 1+)." -ForegroundColor Yellow
    exit 1
  }
  $Collection = $hits[0].id
}
Write-Host ("Använder samlingen: {0}" -f $Collection) -ForegroundColor Green

# ---- 2. Height squares covering the mountain boxes ----
$items = [ordered]@{}
foreach ($name in $boxes.Keys) {
  if ($Box -and $Box -ne $name) { continue }
  $bbox = ($boxes[$name] | ForEach-Object { $_.ToString([Globalization.CultureInfo]::InvariantCulture) }) -join ","
  $url = "$Base/collections/$Collection/items?bbox=$bbox&limit=500"
  $count = 0
  while ($url) {
    $page = Get-Json $url
    foreach ($f in @($page.Json.features)) {
      if (-not $items.Contains($f.id)) { $items[$f.id] = $f }
      $count++
    }
    $url = Next-Link $page.Json
    Write-Host ("  {0}: {1} rutor hittills..." -f $name, $count)
    Start-Sleep -Milliseconds 200
  }
}
$itemsFile = Join-Path $OutDir "stac-items-hojd.json"
@($items.Values) | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $itemsFile

$tifs = 0; $bytes = [int64]0
foreach ($it in $items.Values) {
  foreach ($p in $it.assets.PSObject.Properties) {
    $a = $p.Value
    if (("$($a.type)" -match "tiff") -or ("$($a.href)" -match "\.tiff?($|\?)")) { $tifs++; if ($a.'file:size') { $bytes += [int64]$a.'file:size' } }
  }
}
Write-Host ""
Write-Host ("{0} höjdrutor med GeoTIFF ({1}). Listan sparad i {2}." -f $tifs, $(if ($bytes) { "{0:N1} GB" -f ($bytes / 1GB) } else { "storlek okänd" }), $itemsFile)
if ($tifs -eq 0) {
  Write-Host "Inga GeoTIFF-filer hittades. Skicka stac-items-hojd.json (innehåller inga lösenord) till Claude." -ForegroundColor Yellow
  exit 1
}

if (-not ($DryRun -or $Import)) {
  Write-Host ""
  Write-Host "Provkör nu med -DryRun, och kör sedan -Import när provkörningen ser bra ut."
  exit 0
}

# ---- 3. Slope tiles ----
$worker = Split-Path -Parent $PSScriptRoot
$importArgs = @("tsx", (Join-Path $PSScriptRoot "import-slope.ts"), "--items", $itemsFile)
if ($DryRun) { $importArgs += "--dry-run" }
if ($Skip -gt 0) { $importArgs += @("--skip", "$Skip") }
if ($Box) { $importArgs += @("--box", $Box) }
Write-Host ""
Write-Host ($(if ($DryRun) { "Provkör (räknar några områden, laddar inte upp något)..." } else { "Räknar lutning och laddar upp. Det tar några timmar; avbryts det går det bra att fortsätta med -Skip." }))
Push-Location $worker
$env:LM_AUTH = $headers.Authorization
try {
  & npx @importArgs
  $importExit = $LASTEXITCODE
} finally {
  Remove-Item Env:LM_AUTH -ErrorAction SilentlyContinue
  Pop-Location
}
if ($importExit -ne 0) { Write-Host "Importen avbröts (kod $importExit). Skicka utskriften till Claude." -ForegroundColor Red; exit 1 }
if ($DryRun) { Write-Host ("Exempelrutor finns i {0}." -f (Join-Path $worker "slope-prov")) }
