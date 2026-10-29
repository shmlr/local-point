import http from "node:http";
import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 80;
const APP_ID = 54864900;
const REDIRECT_URL = "http://localhost";

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Local Point Collector - VK ID</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:720px;margin:64px auto;padding:0 20px;color:#111}
    button{font:inherit;padding:12px 18px;border:0;border-radius:10px;background:#07f;color:#fff;cursor:pointer}
    #status{margin-top:18px;white-space:pre-wrap}
  </style>
</head>
<body>
  <h1>Local Point Collector</h1>
  <p>Локальный вход через официальный VK ID SDK. Почта и телефон не запрашиваются.</p>
  <button id="login">Войти через VK ID</button>
  <div id="status"></div>

  <script src="https://unpkg.com/@vkid/sdk@2.6.1/dist-sdk/umd/index.js"></script>
  <script>
    const statusEl = document.getElementById('status');
    const loginBtn = document.getElementById('login');
    function status(text) { statusEl.textContent = text; }

    if (!window.VKID) {
      status('SDK_LOAD_FAIL: VK ID SDK не загрузился.');
      loginBtn.disabled = true;
    } else {
      VKID.Config.init({
        app: 54864900,
        redirectUrl: 'http://localhost'
      });

      const qs = new URLSearchParams(location.search);
      const code = qs.get('code');
      const deviceId = qs.get('device_id');

      if (code && deviceId) {
        loginBtn.style.display = 'none';
        status('Получен код VK ID. Обмениваю на токен...');

        VKID.Auth.exchangeCode(code, deviceId)
          .then(async (tokens) => {
            const response = await fetch('/store-token', {
              method: 'POST',
              headers: {'content-type':'application/json'},
              body: JSON.stringify({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || null,
                expires_in: tokens.expires_in || null,
                user_id: tokens.user_id || null,
                device_id: deviceId
              })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || 'store failed');
            history.replaceState({}, '', '/');
            status('VKID_LOGIN=PASS\\nТокен сохранён локально через Windows DPAPI. Эту вкладку можно закрыть.');
          })
          .catch((err) => {
            status('VKID_LOGIN=FAIL\\n' + (err?.error || err?.message || String(err)));
          });
      } else {
        loginBtn.onclick = () => {
          status('Открываю VK ID...');
          VKID.Auth.login().catch((err) => status('VKID_LOGIN=FAIL\\n' + (err?.message || String(err))));
        };
      }
    }
  </script>
</body>
</html>`;

function storeTokens(payload) {
  return new Promise((resolve, reject) => {
    const psScript = [
      '$ErrorActionPreference="Stop"',
      '$json=[Console]::In.ReadToEnd() | ConvertFrom-Json',
      '$dir=Join-Path $env:LOCALAPPDATA "LocalPoint\\secrets"',
      'New-Item -ItemType Directory -Force -Path $dir | Out-Null',
      '$access=ConvertTo-SecureString ([string]$json.access_token) -AsPlainText -Force',
      '$access | Export-Clixml -Path (Join-Path $dir "vk-user-token.xml")',
      'if ($json.refresh_token) { $refresh=ConvertTo-SecureString ([string]$json.refresh_token) -AsPlainText -Force; $refresh | Export-Clixml -Path (Join-Path $dir "vk-user-refresh-token.xml") }',
      '$meta=[ordered]@{app_id=54864900;redirect_uri="http://localhost";device_id=$json.device_id;obtained_at=(Get-Date).ToString("o");expires_in=$json.expires_in;user_id=$json.user_id;refresh_token_present=[bool]$json.refresh_token}',
      '$meta | ConvertTo-Json | Set-Content -Encoding UTF8 -Path (Join-Path $dir "vk-user-token-meta.json")'
    ].join('; ');

    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    let stderr = "";
    child.stderr.on("data", d => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(stderr || ("PowerShell exited with code " + code)));
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    res.writeHead(200, {"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
    res.end(html);
    return;
  }

  if (req.method === "POST" && req.url === "/store-token") {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 65536) req.destroy();
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(raw);
        if (!payload.access_token) throw new Error("access_token missing");
        await storeTokens(payload);
        res.writeHead(200, {"content-type":"application/json"});
        res.end(JSON.stringify({ok:true}));
        setTimeout(() => server.close(), 1500);
      } catch (error) {
        res.writeHead(500, {"content-type":"application/json"});
        res.end(JSON.stringify({ok:false,error:error instanceof Error ? error.message : String(error)}));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log("Local Point VK ID SDK login");
  console.log("Open: http://localhost");
  console.log("App ID: " + APP_ID);
  console.log("Mode: official VK ID Web SDK / OAuth 2.1 PKCE");
  console.log("No token is printed.");
});

server.on("error", error => {
  console.error("VKID_LOCAL_SERVER=FAIL");
  console.error(error.message);
  process.exitCode = 2;
});
