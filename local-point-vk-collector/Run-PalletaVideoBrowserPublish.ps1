param(
  [string]$VideoPath,
  [switch]$Execute
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Find-PalletaVideo {
  param([string]$ExplicitPath)

  if ($ExplicitPath) {
    if (-not (Test-Path $ExplicitPath)) { throw "Video file not found: $ExplicitPath" }
    return (Resolve-Path $ExplicitPath).Path
  }

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

  foreach ($Root in $SearchRoots) {
    $Found = Get-ChildItem -Path $Root -Filter $TargetName -File -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($Found) { return $Found.FullName }
  }

  throw "Video file not found automatically: $TargetName"
}

try {
  $ResolvedVideo = Find-PalletaVideo $VideoPath
  $env:VK_VIDEO_PATH = $ResolvedVideo

  if ($Execute) {
    $env:VK_PUBLISH_APPROVAL = "PALLETTA_VIDEO_ONCE"
    Remove-Item Env:VK_PUBLISH_DRY_RUN -ErrorAction SilentlyContinue
    Write-Host "Mode: LOCAL PROFILE / PUBLISH ONE VIDEO TO PALLETTA ONLY" -ForegroundColor Yellow
  } else {
    $env:VK_PUBLISH_DRY_RUN = "1"
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
}
