$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$base = "https://raw.githubusercontent.com/shmlr/local-point/feature/vk-palleta-publisher-v0.1/local-point-vk-collector"
$files = @(
  @{ Remote = "src/api-policy.mjs"; Local = ".\src\api-policy.mjs" },
  @{ Remote = "src/vk-api.mjs"; Local = ".\src\vk-api.mjs" },
  @{ Remote = "test/api-policy.test.mjs"; Local = ".\test\api-policy.test.mjs" },
  @{ Remote = "src/publish-policy.mjs"; Local = ".\src\publish-policy.mjs" },
  @{ Remote = "src/vk-publish.mjs"; Local = ".\src\vk-publish.mjs" },
  @{ Remote = "src/publish-video.mjs"; Local = ".\src\publish-video.mjs" },
  @{ Remote = "src/publish-video-browser.mjs"; Local = ".\src\publish-video-browser.mjs" },
  @{ Remote = "Run-PalletaVideoPublish.ps1"; Local = ".\Run-PalletaVideoPublish.ps1" },
  @{ Remote = "Run-PalletaVideoBrowserPublish.ps1"; Local = ".\Run-PalletaVideoBrowserPublish.ps1" },
  @{ Remote = "test/publish-policy.test.mjs"; Local = ".\test\publish-policy.test.mjs" },
  @{ Remote = "docs/VK_PALLETTA_PUBLISH_GATE.md"; Local = ".\docs\VK_PALLETTA_PUBLISH_GATE.md" },
  @{ Remote = "package.json"; Local = ".\package.json" }
)

$cacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

foreach ($file in $files) {
  $dir = Split-Path $file.Local -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $url = $base + "/" + $file.Remote + "?v=" + $cacheBust
  Invoke-WebRequest $url -Headers @{ "Cache-Control" = "no-cache" } -OutFile $file.Local
}

$runnerPath = Join-Path $PSScriptRoot "Run-PalletaVideoBrowserPublish.ps1"
$runnerText = Get-Content -Raw -Path $runnerPath
if ($runnerText -notmatch 'PALLETTA_RUNNER_VERSION' -or $runnerText -notmatch '0\.1\.4') {
  throw "SYNC_VERSION_MISMATCH: expected Palleta runner 0.1.4"
}

Write-Host "SYNC_PALLETTA_PUBLISHER=PASS" -ForegroundColor Green
Write-Host "PALLETTA_RUNNER_VERSION=0.1.4" -ForegroundColor Green
Write-Host "Running tests..."
& "C:\Program Files\nodejs\npm.cmd" test
if ($LASTEXITCODE -ne 0) { throw "Publisher tests failed after sync." }

Write-Host "READY_FOR_DRY_RUN" -ForegroundColor Green
Write-Host "Dry run:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoBrowserPublish.ps1"
Write-Host "Live publish:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoBrowserPublish.ps1 -Execute"
