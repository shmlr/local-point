import test from "node:test";
import assert from "node:assert/strict";
import {
  STRICT_ALLOWED_METHODS,
  classifyTransportRequest,
  isStrictReadOnlyMethod
} from "../src/policy.mjs";
import { sanitizeUrl } from "../src/lib.mjs";

test("strict policy allows only GET HEAD OPTIONS", () => {
  for (const method of STRICT_ALLOWED_METHODS) {
    assert.equal(isStrictReadOnlyMethod(method), true);
  }

  for (const method of ["POST", "PUT", "PATCH", "DELETE", "CONNECT"]) {
    assert.equal(isStrictReadOnlyMethod(method), false);
  }
});

test("request classifier blocks mutation-capable transport methods", () => {
  const result = classifyTransportRequest({
    method: "post",
    url: "https://vk.com/al_wall.php",
    resourceType: "xhr"
  });

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.method, "POST");
  assert.equal(result.policy, "STRICT_TRANSPORT_READ_ONLY");
});

test("URL sanitizer removes credentials query and hash", () => {
  const safe = sanitizeUrl(
    "https://user:secret@example.com/path?a=token#fragment"
  );

  assert.equal(safe, "https://example.com/path");
});

test("URL sanitizer preserves useful path", () => {
  assert.equal(
    sanitizeUrl("https://vk.com/palleta.store?w=wall-1_2"),
    "https://vk.com/palleta.store"
  );
});
