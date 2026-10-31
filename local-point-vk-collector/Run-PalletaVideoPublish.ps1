param(
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

  if (-not $VideoPath) {
    $TargetName = "Паллета_Reels_мука_Снежана_2_5_10кг.mp4"
    $SearchRoots = @(
      $PSScriptRoot,
      (Join-Path $HOME "Downloads"),
      (Join-Path $HOME "Desktop"),
      (Join-Path $HOME "Documents"),
      "D:\R01-Agent-Workspace",
      "D:\Файлы проектов",
      "D:\Проекты"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

    $Found = $null
    foreach ($Root in $SearchRoots) {
      $Found = Get-ChildItem -Path $Root -Filter $TargetName -File -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1
      if ($Found) { break }
    }

    if ($Found) {
      $VideoPath = $Found.FullName
      Write-Host ("Video auto-detected: " + $VideoPath) -ForegroundColor Green
    } else {
      throw "Video file not found automatically: $TargetName"
    }
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
