$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$SecretDir = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets"
$TokenFile = Join-Path $SecretDir "vk-service-token.xml"

New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null

Write-Host "Local Point VK - service token setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Paste the VK SERVICE ACCESS KEY from the app settings."
Write-Host "The key is not printed and will be protected with Windows DPAPI."
Write-Host ""

$TokenSecure = Read-Host "VK SERVICE ACCESS KEY" -AsSecureString

if (-not $TokenSecure) {
  throw "VK service access key is required."
}

$TokenSecure | Export-Clixml -Path $TokenFile

Write-Host ""
Write-Host "PASS: service access key stored locally with Windows DPAPI." -ForegroundColor Green
Write-Host "Token file: $TokenFile"
Write-Host "The key itself was not printed."
