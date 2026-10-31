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

foreach ($file in $files) {
  $dir = Split-Path $file.Local -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  Invoke-WebRequest ($base + "/" + $file.Remote) -OutFile $file.Local
}

Write-Host "SYNC_PALLETTA_PUBLISHER=PASS" -ForegroundColor Green
Write-Host "Running tests..."
& "C:\Program Files\nodejs\npm.cmd" test
if ($LASTEXITCODE -ne 0) { throw "Publisher tests failed after sync." }

Write-Host "READY_FOR_DRY_RUN" -ForegroundColor Green
Write-Host "Dry run:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoBrowserPublish.ps1"
Write-Host "Live publish:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\Run-PalletaVideoBrowserPublish.ps1 -Execute"
