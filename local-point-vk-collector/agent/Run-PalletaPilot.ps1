$ErrorActionPreference = "Stop"

$CollectorRoot = Split-Path -Parent $PSScriptRoot
Set-Location $CollectorRoot

$env:VK_TARGET_URL = "https://vk.com/palleta.store"

Write-Host "LP Collector Agent - Palleta VK pilot" -ForegroundColor Cyan
Write-Host "Target: $env:VK_TARGET_URL"
Write-Host "Mode: STRICT READ-ONLY"
Write-Host ""

& (Join-Path $CollectorRoot "Start-VKCollector.ps1")
exit $LASTEXITCODE
