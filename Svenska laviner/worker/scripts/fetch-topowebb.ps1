# Hämtar Lantmäteriets "Topografisk webbkarta Nedladdning, raster" (GeoPackage)
# för fjällområdena från deras STAC-API, så att import-tiles.ts kan ladda upp
# kartbitarna till R2. Kräver att Geotorget-kontot har behörighet till
# produkten (beställd 2026-10-06, ärende LM2026/152399).
#
# Cloud sessions can't reach api.lantmateriet.se, so run this locally:
#
#   cd "Svenska laviner\worker"
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1             # visa bara vad som finns
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-topowebb.ps1 -Download   # ladda ner
#
# Inloggningen (Geotorget-e-post + lösenord) frågas efter varje gång och
# sparas aldrig. Filerna stac-*.json som skriptet sparar innehåller inga
# lösenord och kan skickas vidare om något behöver felsökas.

param(
  [switch]$Download,
  [string]$Collection = "",
  [string]$OutDir = (Join-Path $env:USERPROFILE "Downloads\topowebb")
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is very slow with the progress bar
$base = "https://api.lantmateriet.se/stac-karta/v1"
$ua = "Snolage-kartbyte"

# The three mountain boxes from KARTBYTE.md (SWEREF 99 TM), in WGS84 with a small margin.
$boxes = [ordered]@{
  "Norra (Kebnekaise, Abisko/Riksgränsen)"           = @(16.85, 67.43, 20.51, 68.72)
  "Mitten (Västra Vindelfjällen, Södra Lapplandsfj.)" = @(13.77, 64.70, 16.43, 66.35)
  "Södra (Södra Jämtland, Västra Härjedalen)"         = @(11.65, 62.11, 14.20, 63.94)
}

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
      Write-Host "Inloggningen godtogs inte ($code). Kontrollera e-post/lösenord och att beställningen syns som AVSLUTAD/Lyckad på Geotorget." -ForegroundColor Red
      exit 1
    }
    throw
  }
  # Read as UTF-8 regardless of what PowerShell 5 guesses.
  $text = [Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
  return @{ Text = $text; Json = ($text | ConvertFrom-Json) }
}

function Next-Link($json) {
  foreach ($l in @($json.links)) { if ($l.rel -eq "next" -and $l.href) { return $l.href } }
  return $null
}

# ---- 1. Which collection holds the product ----
Write-Host "Hämtar katalogen..."
$cols = Get-Json "$base/collections"
$cols.Text | Set-Content -Encoding UTF8 (Join-Path $OutDir "stac-collections.json")
Write-Host "Samlingar i API:et:"
foreach ($c in @($cols.Json.collections)) { Write-Host ("  {0}  –  {1}" -f $c.id, $c.title) }

if (-not $Collection) {
  $hits = @($cols.Json.collections | Where-Object {
      ("$($_.id) $($_.title)" -match "webbkarta|topowebb") -and ("$($_.id) $($_.title)" -notmatch "visning")
    })
  if ($hits.Count -ne 1) {
    Write-Host ""
    Write-Host "Kunde inte välja samling automatiskt ($($hits.Count) träffar). Kör igen med -Collection <id> från listan ovan." -ForegroundColor Yellow
    exit 1
  }
  $Collection = $hits[0].id
}
Write-Host ("Använder samlingen: {0}" -f $Collection) -ForegroundColor Green

# ---- 2. Items (map sheets) covering the mountain boxes ----
$items = [ordered]@{}
foreach ($name in $boxes.Keys) {
  $bbox = ($boxes[$name] | ForEach-Object { $_.ToString([Globalization.CultureInfo]::InvariantCulture) }) -join ","
  $url = "$base/collections/$Collection/items?bbox=$bbox&limit=100"
  $count = 0
  while ($url) {
    $page = Get-Json $url
    foreach ($f in @($page.Json.features)) {
      if (-not $items.Contains($f.id)) { $items[$f.id] = $f }
      $count++
    }
    $url = Next-Link $page.Json
    Start-Sleep -Milliseconds 300
  }
  Write-Host ("  {0}: {1} kartblad" -f $name, $count)
}
$items.Values | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 (Join-Path $OutDir "stac-items.json")

# ---- 3. The GeoPackage files, Web Mercator only ----
$files = @()
foreach ($it in $items.Values) {
  $epsg = $it.properties.'proj:epsg'
  foreach ($p in $it.assets.PSObject.Properties) {
    $a = $p.Value
    $isGpkg = ("$($a.type)" -match "geopackage|sqlite") -or ("$($a.href)" -match "\.gpkg(\?|$)")
    if (-not $isGpkg) { continue }
    $assetEpsg = $a.'proj:epsg'
    if (-not $assetEpsg) { $assetEpsg = $epsg }
    $files += [pscustomobject]@{
      Item  = $it.id
      Asset = $p.Name
      Epsg  = $assetEpsg
      Size  = $a.'file:size'
      Href  = $a.href
      Name  = [IO.Path]::GetFileName(([uri]$a.href).AbsolutePath)
    }
  }
}
$mercator = @($files | Where-Object { $_.Epsg -eq 3857 -or $_.Epsg -eq $null })
if ($mercator.Count -lt $files.Count) {
  Write-Host ("Hoppar över {0} filer i annan projektion än Web Mercator (EPSG:3857)." -f ($files.Count - $mercator.Count))
}
$files = $mercator

Write-Host ""
Write-Host ("{0} kartblad, {1} GeoPackage-filer:" -f $items.Count, $files.Count)
$files | Select-Object -First 15 | ForEach-Object {
  $mb = if ($_.Size) { "{0:N0} MB" -f ($_.Size / 1MB) } else { "okänd storlek" }
  Write-Host ("  {0}  [{1}, EPSG {2}, {3}]" -f $_.Name, $_.Asset, $_.Epsg, $mb)
}
if ($files.Count -gt 15) { Write-Host ("  … och {0} till" -f ($files.Count - 15)) }
$known = ($files | Where-Object { $_.Size } | Measure-Object -Property Size -Sum).Sum
if ($known) { Write-Host ("Totalt (kända storlekar): {0:N1} GB" -f ($known / 1GB)) }
$names = @($files | Group-Object Name | Where-Object { $_.Count -gt 1 })
if ($names.Count -gt 0) { Write-Host "OBS: flera filer har samma namn – de sparas med kartbladets id före." -ForegroundColor Yellow }

if (-not $Download) {
  Write-Host ""
  Write-Host "Inget nedladdat än. Skicka utskriften ovan till Claude, eller kör igen med -Download." -ForegroundColor Cyan
  exit 0
}

# ---- 4. Download, gently (one file at a time) and resumable ----
$i = 0
foreach ($f in $files) {
  $i++
  $target = if ($names.Count -gt 0) { Join-Path $OutDir ("{0}_{1}" -f $f.Item, $f.Name) } else { Join-Path $OutDir $f.Name }
  if ((Test-Path $target) -and (-not $f.Size -or (Get-Item $target).Length -eq $f.Size)) {
    Write-Host ("  [{0}/{1}] finns redan: {2}" -f $i, $files.Count, (Split-Path $target -Leaf))
    continue
  }
  Write-Host ("  [{0}/{1}] laddar ner {2} ..." -f $i, $files.Count, (Split-Path $target -Leaf))
  $part = "$target.part"
  try {
    Invoke-WebRequest -Uri $f.Href -Headers $headers -UserAgent $ua -OutFile $part -TimeoutSec 3600 -UseBasicParsing
    Move-Item -Force $part $target
  } catch {
    Write-Host ("      FEL: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Remove-Item -ErrorAction SilentlyContinue $part
  }
  Start-Sleep -Seconds 1
}
$headers = $null

Write-Host ""
Write-Host "Klart. Kör nu importen som provkörning:" -ForegroundColor Green
Write-Host "  npx tsx scripts/import-tiles.ts --dry-run (Get-ChildItem $OutDir\*.gpkg).FullName"
