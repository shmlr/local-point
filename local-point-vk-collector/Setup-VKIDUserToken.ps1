$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$AppId = "54864900"
$RedirectUri = "http://localhost"
$SdkVersion = "2.6.1"
$SecretDir = Join-Path $env:LOCALAPPDATA "LocalPoint\secrets"
$AccessFile = Join-Path $SecretDir "vk-user-token.xml"
$RefreshFile = Join-Path $SecretDir "vk-user-refresh-token.xml"
$MetaFile = Join-Path $SecretDir "vk-user-token-meta.json"

function New-RandomBase64Url([int]$BytesCount) {
  $bytes = New-Object byte[] $BytesCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+","-").Replace("/","_")
}

function To-Base64Url([byte[]]$Bytes) {
  return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+","-").Replace("/","_")
}

$CodeVerifier = New-RandomBase64Url 32
$State = New-RandomBase64Url 24
$sha = [System.Security.Cryptography.SHA256]::Create()
try {
  $challengeBytes = $sha.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($CodeVerifier))
} finally {
  $sha.Dispose()
}
$CodeChallenge = To-Base64Url $challengeBytes

$params = [ordered]@{
  client_id = $AppId
  response_type = "code"
  code_challenge = $CodeChallenge
  code_challenge_method = "s256"
  state = $State
  redirect_uri = $RedirectUri
  app_id = $AppId
  v = $SdkVersion
  sdk_type = "vkid"
  localhost = "1"
}

$query = ($params.GetEnumerator() | ForEach-Object {
  ([uri]::EscapeDataString([string]$_.Key) + "=" + [uri]::EscapeDataString([string]$_.Value))
}) -join "&"

$AuthUrl = "https://id.vk.ru/authorize?$query"
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 80)

try {
  try {
    $listener.Start()
  } catch {
    Write-Host "VKID_LOGIN=BLOCKED" -ForegroundColor Yellow
    Write-Host "REASON=LOCAL_CALLBACK_PORT_80_UNAVAILABLE"
    exit 4
  }

  Write-Host "Local Point VK ID login" -ForegroundColor Cyan
  Write-Host "App ID: $AppId"
  Write-Host "Redirect: $RedirectUri"
  Write-Host "Mode: PKCE / LOCALHOST / READ-ONLY"
  Write-Host ""
  Write-Host "Opening VK ID in browser..."
  Start-Process $AuthUrl

  $deadline = (Get-Date).AddMinutes(5)
  while (-not $listener.Pending()) {
    if ((Get-Date) -gt $deadline) {
      Write-Host "VKID_LOGIN=FAIL" -ForegroundColor Red
      Write-Host "REASON=CALLBACK_TIMEOUT"
      exit 5
    }
    Start-Sleep -Milliseconds 200
  }

  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
    $requestLine = $reader.ReadLine()

    if (-not $requestLine -or $requestLine -notmatch "^GET\s+([^\s]+)\s+HTTP/") {
      throw "Invalid localhost callback request."
    }

    $target = $Matches[1]
    $uri = [uri]("http://localhost" + $target)
    Add-Type -AssemblyName System.Web
    $q = [System.Web.HttpUtility]::ParseQueryString($uri.Query)

    $code = $q["code"]
    $deviceId = $q["device_id"]
    $returnedState = $q["state"]
    $oauthError = $q["error"]
    $oauthErrorDesc = $q["error_description"]

    $html = "<html><body><h2>Local Point Collector</h2><p>Authorization received. You can close this tab.</p></body></html>"
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($html)
    $nl = [Environment]::NewLine
    $headers = "HTTP/1.1 200 OK" + $nl + "Content-Type: text/html; charset=utf-8" + $nl + "Content-Length: " + $bodyBytes.Length + $nl + "Connection: close" + $nl + $nl
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    $stream.Flush()

    if ($oauthError) {
      Write-Host "VKID_LOGIN=FAIL" -ForegroundColor Red
      Write-Host ("OAUTH_ERROR=" + $oauthError)
      if ($oauthErrorDesc) { Write-Host ("OAUTH_ERROR_DESCRIPTION=" + $oauthErrorDesc) }
      exit 6
    }

    if (-not $code -or -not $deviceId) {
      Write-Host "VKID_LOGIN=FAIL" -ForegroundColor Red
      Write-Host "REASON=MISSING_CODE_OR_DEVICE_ID"
      exit 7
    }

    if ($returnedState -ne $State) {
      Write-Host "VKID_LOGIN=FAIL" -ForegroundColor Red
      Write-Host "REASON=STATE_MISMATCH"
      exit 8
    }

    $tokenParams = [ordered]@{
      grant_type = "authorization_code"
      redirect_uri = $RedirectUri
      client_id = $AppId
      code_verifier = $CodeVerifier
      state = $State
      device_id = $deviceId
    }

    $tokenQuery = ($tokenParams.GetEnumerator() | ForEach-Object {
      ([uri]::EscapeDataString([string]$_.Key) + "=" + [uri]::EscapeDataString([string]$_.Value))
    }) -join "&"

    $tokenUri = "https://id.vk.ru/oauth2/auth?$tokenQuery"

    try {
      $tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUri -Body @{ code = $code } -ContentType "application/x-www-form-urlencoded"
    } catch {
      Write-Host "VKID_LOGIN=FAIL" -ForegroundColor Red
      Write-Host "REASON=TOKEN_EXCHANGE_FAILED"
      exit 9
    }

    if (-not $tokenResponse.access_token) {
      Write-Host "VKID_LOGIN=FAIL" -ForegroundColor Red
      Write-Host "REASON=ACCESS_TOKEN_MISSING"
      exit 10
    }

    New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null
    ConvertTo-SecureString $tokenResponse.access_token -AsPlainText -Force | Export-Clixml -Path $AccessFile

    if ($tokenResponse.refresh_token) {
      ConvertTo-SecureString $tokenResponse.refresh_token -AsPlainText -Force | Export-Clixml -Path $RefreshFile
    }

    $meta = [ordered]@{
      app_id = $AppId
      redirect_uri = $RedirectUri
      device_id = $deviceId
      obtained_at = (Get-Date).ToString("o")
      expires_in = $tokenResponse.expires_in
      user_id = $tokenResponse.user_id
      refresh_token_present = [bool]$tokenResponse.refresh_token
    }
    $meta | ConvertTo-Json | Set-Content -Path $MetaFile -Encoding UTF8

    Write-Host ""
    Write-Host "VKID_LOGIN=PASS" -ForegroundColor Green
    Write-Host "Access token stored with Windows DPAPI."
    Write-Host "Refresh token stored with Windows DPAPI:" ([bool]$tokenResponse.refresh_token)
    Write-Host "The tokens were not printed."
  } finally {
    if ($reader) { $reader.Dispose() }
    if ($stream) { $stream.Dispose() }
    if ($client) { $client.Close() }
  }
} finally {
  $listener.Stop()
  Remove-Variable CodeVerifier -ErrorAction SilentlyContinue
}