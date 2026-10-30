param(
  [Parameter(Mandatory = $true)]
  [string]$VideoPath,

  [switch]$Execute
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$SecretDir = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets"
$UserTokenFile = Join-Path $SecretDir "vk-user-token.xml"

function Read-DpapiSecureString([string]$Path) {
  $secure = Import-Clixml -Path $Path
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

try {
  if (-not (Test-Path $UserTokenFile)) {
    throw "VK user token not found at $UserTokenFile"
  }

  if (-not (Test-Path $VideoPath)) {
    throw "Video file not found: $VideoPath"
  }

  $env:VK_USER_TOKEN = Read-DpapiSecureString $UserTokenFile
  $env:VK_VIDEO_PATH = (Resolve-Path $VideoPath).Path

  if ($Execute) {
    $env:VK_PUBLISH_APPROVAL = "PALLETTA_VIDEO_ONCE"
    Remove-Item Env:VK_PUBLISH_DRY_RUN -ErrorAction SilentlyContinue
    Write-Host "Mode: PUBLISH ONE VIDEO TO PALLETTA ONLY" -ForegroundColor Yellow
  } else {
    $env:VK_PUBLISH_DRY_RUN = "1"
    Remove-Item Env:VK_PUBLISH_APPROVAL -ErrorAction SilentlyContinue
    Write-Host "Mode: DRY RUN / NO WRITE" -ForegroundColor Cyan
  }

  & "C:\Program Files\nodejs\node.exe" ".\src\publish-video.mjs"
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:VK_USER_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:VK_VIDEO_PATH -ErrorAction SilentlyContinue
  Remove-Item Env:VK_PUBLISH_APPROVAL -ErrorAction SilentlyContinue
  Remove-Item Env:VK_PUBLISH_DRY_RUN -ErrorAction SilentlyContinue
}
