$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$branchApi = "https://api.github.com/repos/shmlr/local-point/commits/feature%2Fvk-palleta-publisher-v0.1"
$commit = Invoke-RestMethod -Uri $branchApi -Headers @{ "User-Agent" = "LocalPoint-Publisher-Sync" }
$commitSha = [string]$commit.sha
if ($commitSha -notmatch '^[0-9a-f]{40}$') {
  throw "SYNC_COMMIT_SHA_INVALID"
}

$base = "https://raw.githubusercontent.com/shmlr/local-point/$commitSha/local-point-vk-collector"
$files = @(
  @{ Remote = "src/api-policy.mjs"; Local = ".\src\api-policy.mjs" },
  @{ Remote = "src/vk-api.mjs"; Local = ".\src\vk-api.mjs" },
  @{ Remote = "test/api-policy.test.mjs"; Local = ".\test\api-policy.test.mjs" },
  @{ Remote = "src/palleta-post-template.mjs"; Local = ".\src\palleta-post-template.mjs" },
  @{ Remote = "src/publish-policy.mjs"; Local = ".\src\publish-policy.mjs" },
  @{ Remote = "src/vk-publish.mjs"; Local = ".\src\vk-publish.mjs" },
  @{ Remote = "src/publish-video.mjs"; Local = ".\src\publish-video.mjs" },
  @{ Remote = "src/publish-video-browser.mjs"; Local = ".\src\publish-video-browser.mjs" },
  @{ Remote = "Run-PalletaVideoPublish.ps1"; Local = ".\Run-PalletaVideoPublish.ps1" },
  @{ Remote = "Run-PalletaVideoBrowserPublish.ps1"; Local = ".\Run-PalletaVideoBrowserPublish.ps1" },
  @{ Remote = "Find-PalletaSnezhanaLocalEvidence.ps1"; Local = ".\Find-PalletaSnezhanaLocalEvidence.ps1" },
  @{ Remote = "test/palleta-post-template.test.mjs"; Local = ".\test\palleta-post-template.test.mjs" },
  @{ Remote = "test/publish-policy.test.mjs"; Local = ".\test\publish-policy.test.mjs" },
  @{ Remote = "examples/Palleta_Snezhana_5kg_facts.json"; Local = ".\examples\Palleta_Snezhana_5kg_facts.json" },
  @{ Remote = "docs/VK_PALLETTA_PUBLISH_GATE.md"; Local = ".\docs\VK_PALLETTA_PUBLISH_GATE.md" },
  @{ Remote = "README.md"; Local = ".\README.md" },
  @{ Remote = "package.json"; Local = ".\package.json" }
)

foreach ($file in $files) {
  $dir = Split-Path $file.Local -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $url = $base + "/" + $file.Remote
  Invoke-WebRequest $url -Headers @{
    "Cache-Control" = "no-cache"
    "User-Agent" = "LocalPoint-Publisher-Sync"
  } -OutFile $file.Local
}

$runnerPath = Join-Path $PSScriptRoot "Run-PalletaVideoBrowserPublish.ps1"
$runnerText = Get-Content -Raw -Path $runnerPath
if ($runnerText -notmatch 'PALLETTA_RUNNER_VERSION' -or $runnerText -notmatch '0\.3\.0') {
  throw "SYNC_VERSION_MISMATCH: expected Palleta runner 0.3.0"
}

Write-Host "SYNC_PALLETTA_PUBLISHER=PASS" -ForegroundColor Green
Write-Host ("PINNED_COMMIT=" + $commitSha) -ForegroundColor DarkGray
Write-Host "PALLETTA_RUNNER_VERSION=0.3.0" -ForegroundColor Green
Write-Host "Running tests..."
& "C:\Program Files\nodejs\npm.cmd" test
if ($LASTEXITCODE -ne 0) { throw "Publisher tests failed after sync." }

Write-Host "READY_FOR_VERIFIED_FACTS" -ForegroundColor Yellow
Write-Host "The example facts file is blocked by default."
Write-Host "Do not run -Execute until current Snezhana 5 kg price and stock are verified."
