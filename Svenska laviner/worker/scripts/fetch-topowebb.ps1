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

# ---- 2. Items covering the mountain boxes ----
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
  Write-Host ("  {0}: {1} poster" -f $name, $count)
}
$items.Values | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 (Join-Path $OutDir "stac-items.json")

# ---- 3. The GeoPackage file: coloured, Web Mercator ----
# Lantmäteriet ships all of Sweden per variant (SWEREF/Web Mercator, coloured/"nedtonad"), ~150 GB each.
$files = @()
foreach ($it in $items.Values) {
  foreach ($p in $it.assets.PSObject.Properties) {
    $a = $p.Value
    $name = [IO.Path]::GetFileName(([uri]$a.href).AbsolutePath)
    $isGpkg = ("$($a.type)" -match "geopackage|sqlite") -or ($name -match "\.gpkg$")
    if (-not $isGpkg) { continue }
    $epsg = $a.'proj:epsg'
    if (-not $epsg) { $epsg = $it.properties.'proj:epsg' }
    if (-not $epsg -and $name -match "-(\d{4,5})\.gpkg$") { $epsg = [int]$Matches[1] }
    $files += [pscustomobject]@{ Item = $it.id; Name = $name; Epsg = $epsg; Size = $a.'file:size'; Href = $a.href }
  }
}

Write-Host ""
Write-Host "GeoPackage-filer i samlingen:"
foreach ($f in $files) {
  $gb = if ($f.Size) { "{0:N1} GB" -f ($f.Size / 1GB) } else { "okänd storlek" }
  Write-Host ("  {0}  [EPSG {1}, {2}]" -f $f.Name, $f.Epsg, $gb)
}
$pick = @($files | Where-Object { $_.Epsg -eq 3857 -and $_.Name -notmatch "nedton" })
if ($pick.Count -ne 1) {
  Write-Host "Hittade inte exakt en färglagd Web Mercator-fil (EPSG:3857). Skicka utskriften till Claude." -ForegroundColor Yellow
  exit 1
}
$file = $pick[0]
$target = Join-Path $OutDir $file.Name
Write-Host ("Väljer: {0} (färglagd, Web Mercator). De andra behövs inte." -f $file.Name) -ForegroundColor Green

# Does the server allow resuming (HTTP Range)? Matters for a file this size.
$hdrFile = Join-Path $env:TEMP ("snolage-auth-{0}.txt" -f [guid]::NewGuid())
[IO.File]::WriteAllText($hdrFile, "Authorization: $($headers.Authorization)`n")
try {
  $code = & curl.exe -s -L -r 0-99 -o NUL -w "%{http_code}" -H "@$hdrFile" -A $ua $file.Href
  $resume = $code -eq "206"
  Write-Host ("Återupptagning (HTTP Range): {0} (svar {1})" -f ($(if ($resume) { "ja" } else { "nej" })), $code)

  $drive = Get-PSDrive -Name (Split-Path -Qualifier $OutDir).TrimEnd(":")
  $have = if (Test-Path $target) { (Get-Item $target).Length } elseif (Test-Path "$target.part") { (Get-Item "$target.part").Length } else { 0 }
  $need = if ($file.Size) { $file.Size - $have } else { 0 }
  Write-Host ("Ledigt på {0}: {1:N0} GB, behövs: {2:N0} GB" -f $drive.Name, ($drive.Free / 1GB), ($need / 1GB))

  if (-not $Download) {
    Write-Host ""
    Write-Host "Inget nedladdat än. Skicka utskriften ovan till Claude, eller kör igen med -Download." -ForegroundColor Cyan
    exit 0
  }
  if (Test-Path $target) {
    if (-not $file.Size -or (Get-Item $target).Length -eq $file.Size) { Write-Host "Filen finns redan: $target" -ForegroundColor Green; exit 0 }
  }
  if ($file.Size -and $drive.Free -lt $need + 2GB) {
    Write-Host "För lite ledigt utrymme. Välj en annan disk med -OutDir, t.ex. -OutDir E:\topowebb" -ForegroundColor Red
    exit 1
  }

  # ---- 4. Download with curl (built into Windows), resumable: just run again if it stops ----
  Write-Host ("Laddar ner till {0}.part – det tar många timmar. Avbryt med Ctrl+C och kör samma kommando igen för att fortsätta." -f $target)
  $curlArgs = @("-L", "--fail", "--retry", "20", "--retry-delay", "30", "--retry-all-errors", "-H", "@$hdrFile", "-A", $ua, "-o", "$target.part")
  if ($resume) { $curlArgs += @("-C", "-") }
  & curl.exe @curlArgs $file.Href
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Nedladdningen avbröts (curl kod $LASTEXITCODE). Kör samma kommando igen för att fortsätta." -ForegroundColor Red
    exit 1
  }
  if ($file.Size -and (Get-Item "$target.part").Length -ne $file.Size) {
    Write-Host "Filen blev inte komplett. Kör samma kommando igen för att fortsätta." -ForegroundColor Red
    exit 1
  }
  Move-Item -Force "$target.part" $target
} finally {
  Remove-Item -ErrorAction SilentlyContinue $hdrFile
  $headers = $null
}

Write-Host ""
Write-Host "Klart. Kör nu importen som provkörning (läser bara fjällrutorna ur filen):" -ForegroundColor Green
Write-Host "  npx tsx scripts/import-tiles.ts --dry-run `"$target`""
