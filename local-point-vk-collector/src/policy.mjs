export const STRICT_ALLOWED_METHODS = Object.freeze([
  "GET",
  "HEAD",
  "OPTIONS"
]);

export function normalizeMethod(method) {
  return String(method || "").trim().toUpperCase();
}

export function isStrictReadOnlyMethod(method) {
  return STRICT_ALLOWED_METHODS.includes(normalizeMethod(method));
}

export function classifyTransportRequest({ method, url, resourceType }) {
  const normalizedMethod = normalizeMethod(method);
  return {
    decision: isStrictReadOnlyMethod(normalizedMethod) ? "ALLOW" : "BLOCK",
    method: normalizedMethod,
    url,
    resourceType: resourceType || "unknown",
    policy: "STRICT_TRANSPORT_READ_ONLY"
  };
}
