import {
  VK_API_VERSION,
  assertReadOnlyVkMethod
} from "./api-policy.mjs";

const API_ROOT = "https://api.vk.com/method";

export async function callVkReadOnly({
  method,
  params = {},
  token,
  tokenType,
  fetchImpl = fetch
}) {
  if (!token) throw new Error(`Missing VK ${tokenType} token for ${method}`);
  assertReadOnlyVkMethod(method, tokenType);

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) body.set(key, value.join(","));
    else if (typeof value === "boolean") body.set(key, value ? "1" : "0");
    else body.set(key, String(value));
  }
  body.set("access_token", token);
  body.set("v", VK_API_VERSION);

  const response = await fetchImpl(`${API_ROOT}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "LocalPoint-VK-Collector/0.3"
    },
    body
  });
  if (!response.ok) throw new Error(`VK API HTTP ${response.status} for allowlisted method ${method}`);
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(`VK API error ${payload.error.error_code ?? "unknown"} for ${method}: ${payload.error.error_msg ?? "unknown"}`);
  }
  return payload?.response;
}
