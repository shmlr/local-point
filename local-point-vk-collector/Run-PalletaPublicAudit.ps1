$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:VK_TARGET_URL = "https://vk.com/palleta.store"
$env:VK_GROUP_ID = "197164485"
try {
  & "C:\Program Files\nodejs\node.exe" ".\src\public-audit.mjs"
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:VK_TARGET_URL -ErrorAction SilentlyContinue
  Remove-Item Env:VK_GROUP_ID -ErrorAction SilentlyContinue
}