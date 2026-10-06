# Downloads real answers from Naturvårdsverket's open avalanche-forecast API
# (GeoServer WFS at nvgis.naturvardsverket.se, documented in "Lavinprognoser –
# en guide till öppna API:er", 2026), so the worker can switch from reading
# lavinprognoser.se's pages to the official API and be tested against
# actual data. Cloud sessions can't reach the API, so run this locally:
#
#   cd "Svenska laviner\worker"
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-api-fixtures.ps1
#
# Files land in src\fixtures\nvgis\. Then commit and push them:
#
#   git add src/fixtures/nvgis
#   git commit -m "Add avalanche API fixtures"
#   git push

$ErrorActionPreference = "Stop"
$base = "https://nvgis.naturvardsverket.se/geoserver/lavinprognoser/ows"
$outDir = Join-Path $PSScriptRoot "..\src\fixtures\nvgis"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$ua = "Snolage-fixtures (fabian.n.sund@gmail.com)"

function Save($name, $url) {
  $file = Join-Path $outDir $name
  try {
    Invoke-WebRequest -Uri $url -OutFile $file -UserAgent $ua -TimeoutSec 60 -UseBasicParsing
    $size = (Get-Item $file).Length
    Write-Host ("  ok   {0} ({1} bytes)" -f $name, $size) -ForegroundColor Green
  } catch {
    Write-Host ("  FEL  {0}: {1}" -f $name, $_.Exception.Message) -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 400   # be gentle with their server
}

function Feature($layer, $viewparams) {
  $url = "${base}?service=WFS&version=1.0.0&request=GetFeature&typeName=lavinprognoser:${layer}&outputformat=application/json"
  if ($viewparams) { $url += "&viewparams=" + [uri]::EscapeDataString($viewparams) }
  return $url
}

Write-Host "Hämtar referensdata..."
Save "capabilities.xml" "${base}?service=WFS&version=1.0.0&request=getCapabilities"
Save "location.json" (Feature "location" $null)
Save "location_center.json" (Feature "location_center" $null)
Save "forecast_view.json" (Feature "forecast_view" $null)

# Area ids come from the location layer; forecasts are asked for per area.
$locations = (Get-Content (Join-Path $outDir "location.json") -Raw -Encoding UTF8 | ConvertFrom-Json).features
Write-Host ("Hittade {0} områden." -f $locations.Count)

# A week from each part of last season (mid-winter, late winter, spring).
$intervals = @(
  @("2026-01-18 00:00", "2026-01-25 00:00"),
  @("2026-02-15 00:00", "2026-02-22 00:00"),
  @("2026-04-05 00:00", "2026-04-12 00:00")
)

foreach ($loc in $locations) {
  $id = $loc.properties.id
  if ($null -eq $id) { $id = ($loc.id -split "\.")[-1] }
  $label = $loc.properties.label
  Write-Host ("Område {0}: {1}" -f $id, $label)
  # "Valid now" (empty out of season, but shows the shape).
  Save ("published_forecasts_{0}_now.json" -f $id) (Feature "published_forecasts" "lang:sv;location:$id")
  foreach ($iv in $intervals) {
    $tag = $iv[0].Substring(0, 10)
    Save ("published_forecasts_by_interval_{0}_{1}.json" -f $id, $tag) (Feature "published_forecasts_by_interval" "lang:sv;location:$id;start_date:$($iv[0]);end_date:$($iv[1])")
  }
  # One specific moment in the middle of last season.
  Save ("published_forecasts_{0}_2026-02-18.json" -f $id) (Feature "published_forecasts" "lang:sv;location:$id;valid_date:2026-02-18 12:00")
  Save ("published_forecast_area_interval_{0}.json" -f $id) (Feature "published_forecast_area_interval" "location:$id;start_date:2026-02-01 00:00;end_date:2026-02-08 00:00")
}

Write-Host ""
Write-Host "Klart. Filerna ligger i $outDir" -ForegroundColor Green
Write-Host "Skicka in dem med: git add src/fixtures/nvgis; git commit -m `"Add avalanche API fixtures`"; git push"
