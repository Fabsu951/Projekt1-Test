# Downloads real, in-season forecast pages from lavinprognoser.se so the
# avalanche-problem parser can be built and tested against actual markup.
# lavinprognoser.se is unreachable from cloud sessions, so run this locally:
#
#   cd "Svenska laviner\worker"
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-fixtures.ps1
#
# Pages land in src\fixtures\lavinprognoser\ as <slug>_<date>.html.

$ErrorActionPreference = "Stop"
$base = "https://www.lavinprognoser.se/oversikt-alla-omraden"
$outDir = Join-Path $PSScriptRoot "..\src\fixtures\lavinprognoser"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Spread over last season: early, mid-winter, late winter and spring (wet snow).
$dates = @("2025-12-20", "2026-01-20", "2026-02-20", "2026-03-20", "2026-04-10")

# The Abisko/Riksgränsfjällen slug is still unknown; the first that loads wins.
$regions = @(
  @("kebnekaisefjallen"),
  @("abisko_riksgransfjallen", "abiskoriksgransfjallen", "abisko-riksgransfjallen", "riksgransfjallen_abisko", "riksgransfjallen"),
  @("vastra_vindelfjallen"),
  @("sodra_lapplandsfjallen"),
  @("sodra_jamtlandsfjallen"),
  @("vastra_harjedalsfjallen")
)

$headers = @{ "Accept-Language" = "sv-SE,sv;q=0.9" }
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Fjallkoll-fixtures"

function Get-Page($url, $path) {
  try {
    Invoke-WebRequest -Uri $url -OutFile $path -UserAgent $ua -Headers $headers -UseBasicParsing
    return $true
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  $url -> HTTP $code"
    return $false
  }
}

# The overview page links to every area, which settles the slug question.
Get-Page "$base/" (Join-Path $outDir "_oversikt.html") | Out-Null

foreach ($slugs in $regions) {
  $found = $null
  foreach ($slug in $slugs) {
    if (Get-Page "$base/$slug/?forecast_date=$($dates[0])" (Join-Path $outDir "$($slug)_$($dates[0]).html")) {
      $found = $slug
      break
    }
    Start-Sleep -Milliseconds 700
  }
  if (-not $found) { Write-Host "No working slug among: $($slugs -join ', ')"; continue }

  foreach ($date in $dates | Select-Object -Skip 1) {
    Start-Sleep -Milliseconds 700
    Get-Page "$base/$found/?forecast_date=$date" (Join-Path $outDir "$($found)_$date.html") | Out-Null
  }
}

Write-Host ""
Write-Host "Saved files (size, mentions 'lavinproblem'):"
Get-ChildItem $outDir -Filter *.html | Sort-Object Name | ForEach-Object {
  $hit = Select-String -Path $_.FullName -Pattern "lavinproblem" -Quiet
  "{0,-45} {1,8:N0} bytes  {2}" -f $_.Name, $_.Length, $(if ($hit) { "ja" } else { "nej" })
}
