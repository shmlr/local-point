param(
  [string]$VideoPath,
  [string]$FactsPath,
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
    $ExpectedBytes = 12092681
    $SearchRoots = @(
      $PSScriptRoot,
      (Join-Path $HOME "Downloads"),
      (Join-Path $HOME "Desktop"),
      (Join-Path $HOME "Documents"),
      "D:\R01-Agent-Workspace",
      "D:\Файлы проектов",
      "D:\Проекты"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

    $Candidates = @()
    foreach ($Root in $SearchRoots) {
      $Candidates += Get-ChildItem -Path $Root -Filter "*.mp4" -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object {
          $_.Length -eq $ExpectedBytes -or
          ($_.Name -match "Reels" -and $_.Name -match "2_5_10")
        }
    }

    $Candidates = @($Candidates | Sort-Object FullName -Unique)

    if ($Candidates.Count -eq 0 -and (Test-Path "D:\")) {
      $Candidates = @(
        Get-ChildItem -Path "D:\" -Filter "*.mp4" -File -Recurse -ErrorAction SilentlyContinue |
          Where-Object {
            $_.Length -eq $ExpectedBytes -or
            ($_.Name -match "Reels" -and $_.Name -match "2_5_10")
          } |
          Sort-Object FullName -Unique
      )
    }

    if ($Candidates.Count -eq 1) {
      $VideoPath = $Candidates[0].FullName
      Write-Host ("Video auto-detected: " + $VideoPath) -ForegroundColor Green
    } elseif ($Candidates.Count -eq 0) {
      throw "Palleta video not found automatically. Expected MP4 size: $ExpectedBytes bytes."
    } else {
      Write-Host "Multiple candidate MP4 files found:" -ForegroundColor Yellow
      $Candidates | ForEach-Object { Write-Host (" - " + $_.FullName) }
      throw "PALLETTA_VIDEO_AMBIGUOUS"
    }
  }

  if (-not (Test-Path $VideoPath)) {
    throw "Video file not found: $VideoPath"
  }

  if (-not $FactsPath) { throw "FactsPath is required for dry-run and live publish." }
  if (-not (Test-Path $FactsPath)) { throw "Facts file not found: $FactsPath" }

  $env:VK_USER_TOKEN = Read-DpapiSecureString $UserTokenFile
  $env:VK_VIDEO_PATH = (Resolve-Path $VideoPath).Path
  $env:VK_PRODUCT_FACTS_PATH = (Resolve-Path $FactsPath).Path

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
  Remove-Item Env:VK_PRODUCT_FACTS_PATH -ErrorAction SilentlyContinue
}
