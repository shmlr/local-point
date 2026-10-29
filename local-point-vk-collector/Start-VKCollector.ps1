$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Stop-WithMessage([string]$Message) {
  Write-Host ""
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  exit 2
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithMessage "Node.js не найден в PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Stop-WithMessage "npm не найден в PATH."
}

if ($env:VK_PROFILE_DIR) {
  $ProfileDir = $env:VK_PROFILE_DIR
}
elseif ($env:LOCALAPPDATA) {
  $ProfileDir = Join-Path $env:LOCALAPPDATA "LocalPoint\vk-profile"
}
else {
  $ProfileDir = Join-Path $PSScriptRoot ".local\vk-profile"
}

if ($env:VK_EVIDENCE_DIR) {
  $EvidenceDir = $env:VK_EVIDENCE_DIR
}
elseif ($env:LOCALAPPDATA) {
  $EvidenceDir = Join-Path $env:LOCALAPPDATA "LocalPoint\vk-evidence"
}
else {
  $EvidenceDir = Join-Path $PSScriptRoot "evidence"
}

Write-Host "Local Point VK Collector v0.1" -ForegroundColor Cyan
Write-Host "Profile:  $ProfileDir"
Write-Host "Evidence: $EvidenceDir"
Write-Host ""

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules\playwright"))) {
  Write-Host "[1/4] Установка локальной зависимости..." -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "npm install завершился с ошибкой."
  }
}
else {
  Write-Host "[1/4] Зависимость уже установлена." -ForegroundColor Green
}

Write-Host "[2/4] Проверка READ-ONLY policy..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage "Тесты READ-ONLY policy не прошли."
}

Write-Host "[3/4] Проверка локального браузера..." -ForegroundColor Yellow
npm run doctor
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage "Chrome/Edge не удалось запустить. См. doctor output."
}

$HasProfile = Test-Path $ProfileDir
if (-not $HasProfile) {
  Write-Host ""
  Write-Host "VK-сессия ещё не создана. Сейчас откроется локальный браузер." -ForegroundColor Yellow
  Write-Host "Войдите в VK вручную. Пароль и 2FA скрипт не читает."
  npm run login
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Не удалось создать локальную VK-сессию."
  }
}

Write-Host "[4/4] READ-ONLY сбор evidence..." -ForegroundColor Yellow
npm run collect
$CollectExit = $LASTEXITCODE

Write-Host ""
if ($CollectExit -eq 0) {
  Write-Host "PASS: evidence собран." -ForegroundColor Green
  Write-Host "Папка: $EvidenceDir"
  exit 0
}

Write-Host "PARTIAL/BLOCKED: строгий READ-ONLY режим не получил достаточно evidence." -ForegroundColor Yellow
Write-Host "Папка: $EvidenceDir"
Write-Host "Проверь blocked-summary.json и blocked-requests.json."
Write-Host "Политика автоматически НЕ ослаблялась."
exit $CollectExit
