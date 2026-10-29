$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$TokenFile = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets\vk-service-token.xml"

if (-not (Test-Path $TokenFile)) {
  Write-Host "TOKEN_DIAGNOSTIC=BLOCKED" -ForegroundColor Yellow
  Write-Host "REASON=TOKEN_FILE_MISSING"
  exit 3
}

$TokenSecure = Import-Clixml -Path $TokenFile
$TokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($TokenSecure)

try {
  $TokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPtr)
  $env:VK_SERVICE_TOKEN = $TokenPlain
  $env:VK_APP_ID = "54864808"

  node .\src\token-diagnostic.mjs
  $ExitCode = $LASTEXITCODE
}
finally {
  Remove-Item Env:VK_SERVICE_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:VK_APP_ID -ErrorAction SilentlyContinue

  if ($TokenPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPtr)
  }

  Remove-Variable TokenPlain -ErrorAction SilentlyContinue
  Remove-Variable TokenSecure -ErrorAction SilentlyContinue
}

exit $ExitCode
