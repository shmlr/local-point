$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$SecretDir = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets"
$UserTokenFile = Join-Path $SecretDir "vk-user-token.xml"
$ServiceTokenFile = Join-Path $SecretDir "vk-service-token.xml"

function Read-DpapiSecureString([string]$Path) {
  $secure = Import-Clixml -Path $Path
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  }
}

try {
  if (Test-Path $UserTokenFile) { $env:VK_USER_TOKEN = Read-DpapiSecureString $UserTokenFile }
  if (Test-Path $ServiceTokenFile) { $env:VK_SERVICE_TOKEN = Read-DpapiSecureString $ServiceTokenFile }
  $env:VK_SCREEN_NAME = "palleta.store"

  Write-Host "Local Point VK API Pilot" -ForegroundColor Cyan
  Write-Host "Target: palleta.store"
  Write-Host "Mode: OFFICIAL VK API / READ-ONLY ALLOWLIST"
  Write-Host "User token:" $(if ($env:VK_USER_TOKEN) { "PRESENT" } else { "MISSING" })
  Write-Host ""

  & "C:\Program Files\nodejs\npm.cmd" run api:collect
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:VK_USER_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:VK_SERVICE_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:VK_SCREEN_NAME -ErrorAction SilentlyContinue
}