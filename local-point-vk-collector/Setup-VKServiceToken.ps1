$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$SecretDir = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets"
$TokenFile = Join-Path $SecretDir "vk-service-token.xml"

New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null

Write-Host "Local Point VK - service token setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Enter VK APP ID."
Write-Host "CLIENT SECRET is not stored or printed."
Write-Host "The service token will be protected with Windows DPAPI for the current user."
Write-Host ""

$AppId = Read-Host "VK APP ID"
if (-not ($AppId -match '^\d+$')) {
  throw "VK APP ID must be numeric."
}

$ClientSecretSecure = Read-Host "VK CLIENT SECRET" -AsSecureString
$SecretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ClientSecretSecure)

try {
  $ClientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($SecretPtr)

  $Response = Invoke-RestMethod -Method Post -Uri "https://oauth.vk.com/access_token" -ContentType "application/x-www-form-urlencoded" -Body @{
    client_id     = $AppId
    client_secret = $ClientSecret
    grant_type    = "client_credentials"
  }
}
finally {
  if ($SecretPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($SecretPtr)
  }
  Remove-Variable ClientSecret -ErrorAction SilentlyContinue
}

if (-not $Response.access_token) {
  throw "VK did not return a service access token."
}

$TokenSecure = ConvertTo-SecureString $Response.access_token -AsPlainText -Force
$TokenSecure | Export-Clixml -Path $TokenFile

Remove-Variable TokenSecure -ErrorAction SilentlyContinue
Remove-Variable Response -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "PASS: service token received and stored locally with Windows DPAPI." -ForegroundColor Green
Write-Host "Token file: $TokenFile"
Write-Host "The token itself was not printed."
