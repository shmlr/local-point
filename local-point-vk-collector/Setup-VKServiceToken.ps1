$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$SecretDir = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets"
$TokenFile = Join-Path $SecretDir "vk-service-token.xml"
$AppId = "54864808"
$ApiVersion = "5.230"

New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null

Write-Host "Local Point VK - service token setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Paste ONLY the VK SERVICE ACCESS KEY from:"
Write-Host "dev.vk.com -> Local Point Collector -> Settings -> Access keys -> Service key"
Write-Host ""
Write-Host "Do NOT use the Protected key."
Write-Host "The token will be validated with read-only apps.get before it is stored."
Write-Host ""

$TokenSecure = Read-Host "VK SERVICE ACCESS KEY" -AsSecureString

if (-not $TokenSecure) {
  throw "VK service access key is required."
}

$TokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($TokenSecure)

try {
  $TokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPtr)

  $Body = @{
    app_id = $AppId
    v = $ApiVersion
    access_token = $TokenPlain
  }

  try {
    $Response = Invoke-RestMethod -Method Post -Uri "https://api.vk.com/method/apps.get" -Body $Body -ContentType "application/x-www-form-urlencoded"
  }
  catch {
    Write-Host ""
    Write-Host "VALIDATION=FAIL" -ForegroundColor Red
    Write-Host "REASON=VK_API_REQUEST_FAILED"
    Write-Host "Existing DPAPI token file was not overwritten."
    exit 2
  }

  if ($Response.error) {
    Write-Host ""
    Write-Host "VALIDATION=FAIL" -ForegroundColor Red
    Write-Host ("VK_ERROR_CODE=" + $Response.error.error_code)
    Write-Host ("VK_ERROR_MSG=" + $Response.error.error_msg)
    Write-Host "Existing DPAPI token file was not overwritten."
    exit 2
  }

  if (-not $Response.response) {
    Write-Host ""
    Write-Host "VALIDATION=FAIL" -ForegroundColor Red
    Write-Host "REASON=NO_VK_RESPONSE"
    Write-Host "Existing DPAPI token file was not overwritten."
    exit 2
  }

  New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null
  $TokenSecure | Export-Clixml -Path $TokenFile

  Write-Host ""
  Write-Host "VALIDATION=PASS" -ForegroundColor Green
  Write-Host "PASS: service access key stored locally with Windows DPAPI." -ForegroundColor Green
  Write-Host "Token file: $TokenFile"
  Write-Host "The key itself was not printed."
}
finally {
  if ($TokenPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPtr)
  }

  Remove-Variable TokenPlain -ErrorAction SilentlyContinue
  Remove-Variable TokenSecure -ErrorAction SilentlyContinue
}
