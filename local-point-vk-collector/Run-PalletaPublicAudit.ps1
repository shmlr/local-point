$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$raw = "https://raw.githubusercontent.com/shmlr/local-point/feature/vk-collector-v0.1/local-point-vk-collector/src/public-audit.mjs"
Invoke-WebRequest $raw -OutFile ".\src\public-audit.mjs"

$env:VK_TARGET_URL = "https://vk.com/palleta.store"
$env:VK_GROUP_ID = "197164485"
try {
  & "C:\Program Files\nodejs\node.exe" ".\src\public-audit.mjs"
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:VK_TARGET_URL -ErrorAction SilentlyContinue
  Remove-Item Env:VK_GROUP_ID -ErrorAction SilentlyContinue
}