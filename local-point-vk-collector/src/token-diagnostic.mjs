import process from "node:process";

const token = process.env.VK_SERVICE_TOKEN || "";
const appId = process.env.VK_APP_ID || "54864808";
const apiVersion = "5.230";

if (!token) {
  console.error("TOKEN_DIAGNOSTIC=BLOCKED");
  console.error("REASON=VK_SERVICE_TOKEN_MISSING");
  process.exit(3);
}

async function probeLegacyBody() {
  const body = new URLSearchParams({
    app_id: appId,
    v: apiVersion,
    access_token: token
  });

  const response = await fetch("https://api.vk.com/method/apps.get", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "LocalPoint-VK-Collector/0.2-token-diagnostic"
    },
    body
  });

  const payload = await response.json().catch(() => ({}));

  return {
    transport: "LEGACY_ACCESS_TOKEN_BODY",
    endpoint: "api.vk.com",
    http_status: response.status,
    ok: Boolean(payload?.response),
    error_code: payload?.error?.error_code ?? null,
    error_msg: payload?.error?.error_msg ?? null
  };
}

async function probeBearer() {
  const body = new URLSearchParams({
    app_id: appId,
    v: apiVersion
  });

  const response = await fetch("https://api.vk.ru/method/apps.get", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "LocalPoint-VK-Collector/0.2-token-diagnostic"
    },
    body
  });

  const payload = await response.json().catch(() => ({}));

  return {
    transport: "BEARER_HEADER",
    endpoint: "api.vk.ru",
    http_status: response.status,
    ok: Boolean(payload?.response),
    error_code: payload?.error?.error_code ?? null,
    error_msg: payload?.error?.error_msg ?? null
  };
}

const results = [];

for (const probe of [probeLegacyBody, probeBearer]) {
  try {
    results.push(await probe());
  } catch (error) {
    results.push({
      transport: probe.name,
      ok: false,
      error_code: null,
      error_msg: error instanceof Error ? error.message : String(error)
    });
  }
}

console.log("VK_TOKEN_DIAGNOSTIC");
console.log(JSON.stringify({
  app_id: appId,
  api_version: apiVersion,
  token_printed: false,
  probes: results
}, null, 2));

if (results.some((item) => item.ok)) {
  console.log("TOKEN_DIAGNOSTIC=PASS");
  process.exit(0);
}

console.log("TOKEN_DIAGNOSTIC=FAIL");
process.exit(2);
