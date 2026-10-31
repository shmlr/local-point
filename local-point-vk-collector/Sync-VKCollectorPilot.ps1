$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$base = "https://raw.githubusercontent.com/shmlr/local-point/feature/vk-collector-v0.1/local-point-vk-collector"
$files = @(
  @{ Remote = "src/api-policy.mjs"; Local = ".\src\api-policy.mjs" },
  @{ Remote = "src/vk-api.mjs"; Local = ".\src\vk-api.mjs" },
  @{ Remote = "src/api-collect.mjs"; Local = ".\src\api-collect.mjs" },
  @{ Remote = "Run-VKApiPilot.ps1"; Local = ".\Run-VKApiPilot.ps1" }
)

foreach ($file in $files) {
  Invoke-WebRequest ($base + "/" + $file.Remote) -OutFile $file.Local
}

Write-Host "SYNC=PASS" -ForegroundColor Green
Write-Host "Updated: api-policy.mjs, vk-api.mjs, api-collect.mjs, Run-VKApiPilot.ps1"