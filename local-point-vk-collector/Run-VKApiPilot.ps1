$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$TokenFile = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets\vk-service-token.xml"

if (-not (Test-Path $TokenFile)) {
  Write-Host "SOURCE_DATA_REQUIRED: VK service token не настроен." -ForegroundColor Yellow
  Write-Host "Сначала запустите:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\Setup-VKServiceToken.ps1"
  exit 3
}

$TokenSecure = Import-Clixml -Path $TokenFile
$TokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($TokenSecure)

try {
  $TokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPtr)
  $env:VK_SERVICE_TOKEN = $TokenPlain
  $env:VK_SCREEN_NAME = "palleta.store"

  Write-Host "Local Point VK API Pilot" -ForegroundColor Cyan
  Write-Host "Target: palleta.store"
  Write-Host "Mode: OFFICIAL VK API / READ-ONLY ALLOWLIST"
  Write-Host ""

  npm run api:collect
  $ExitCode = $LASTEXITCODE
}
finally {
  Remove-Item Env:VK_SERVICE_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:VK_SCREEN_NAME -ErrorAction SilentlyContinue

  if ($TokenPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPtr)
  }

  Remove-Variable TokenPlain -ErrorAction SilentlyContinue
  Remove-Variable TokenSecure -ErrorAction SilentlyContinue
}

exit $ExitCode
