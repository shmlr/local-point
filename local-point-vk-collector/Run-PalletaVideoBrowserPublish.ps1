param(
  [string]$VideoPath,
  [switch]$Execute,
  [switch]$Diagnose
)
$ErrorActionPreference = "Stop"
$RunnerVersion = "0.1.8"
Set-Location $PSScriptRoot
Write-Host ("PALLETTA_RUNNER_VERSION=" + $RunnerVersion) -ForegroundColor DarkGray

function Find-PalletaVideo {
  param([string]$ExplicitPath)

  if ($ExplicitPath) {
    if (-not (Test-Path $ExplicitPath)) { throw "Video file not found: $ExplicitPath" }
    return (Resolve-Path $ExplicitPath).Path
  }

  $ExpectedBytes = 12092681
  $SearchRoots = @(
    $PSScriptRoot,
    (Join-Path $HOME "Downloads"),
    (Join-Path $HOME "Desktop"),
    (Join-Path $HOME "Documents"),
    "D:\R01-Agent-Workspace"
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
    return $Candidates[0].FullName
  }

  if ($Candidates.Count -eq 0) {
    throw "Palleta video not found automatically. Expected MP4 size: $ExpectedBytes bytes."
  }

  Write-Host "Multiple candidate MP4 files found:" -ForegroundColor Yellow
  $Candidates | ForEach-Object { Write-Host (" - " + $_.FullName) }
  throw "PALLETTA_VIDEO_AMBIGUOUS"
}

try {
  $ResolvedVideo = Find-PalletaVideo $VideoPath
  $env:VK_VIDEO_PATH = $ResolvedVideo

  if ($Diagnose) {
    $env:VK_PUBLISH_DIAGNOSE = "1"
    Remove-Item Env:VK_PUBLISH_APPROVAL -ErrorAction SilentlyContinue
    Remove-Item Env:VK_PUBLISH_DRY_RUN -ErrorAction SilentlyContinue
    Write-Host "Mode: DIAGNOSE UI / NO VIDEO UPLOAD / NO PUBLISH" -ForegroundColor Cyan
  } elseif ($Execute) {
    $env:VK_PUBLISH_APPROVAL = "PALLETTA_VIDEO_ONCE"
    Remove-Item Env:VK_PUBLISH_DIAGNOSE -ErrorAction SilentlyContinue
    Remove-Item Env:VK_PUBLISH_DRY_RUN -ErrorAction SilentlyContinue
    Write-Host "Mode: LOCAL PROFILE / PUBLISH ONE VIDEO TO PALLETTA ONLY" -ForegroundColor Yellow
  } else {
    $env:VK_PUBLISH_DRY_RUN = "1"
    Remove-Item Env:VK_PUBLISH_DIAGNOSE -ErrorAction SilentlyContinue
    Remove-Item Env:VK_PUBLISH_APPROVAL -ErrorAction SilentlyContinue
    Write-Host "Mode: DRY RUN / NO WRITE" -ForegroundColor Cyan
  }

  Write-Host ("Video: " + $ResolvedVideo)
  & "C:\Program Files\nodejs\node.exe" ".\src\publish-video-browser.mjs"
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:VK_VIDEO_PATH -ErrorAction SilentlyContinue
  Remove-Item Env:VK_PUBLISH_APPROVAL -ErrorAction SilentlyContinue
  Remove-Item Env:VK_PUBLISH_DRY_RUN -ErrorAction SilentlyContinue
  Remove-Item Env:VK_PUBLISH_DIAGNOSE -ErrorAction SilentlyContinue
}
