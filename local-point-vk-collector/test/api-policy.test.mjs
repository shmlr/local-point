import test from "node:test";
import assert from "node:assert/strict";
import {
  assertReadOnlyVkMethod,
  getReadOnlyMethodPolicy
} from "../src/api-policy.mjs";
import { callVkReadOnly } from "../src/vk-api.mjs";

test("service token is allowed for wall.get", () => {
  assert.doesNotThrow(() =>
    assertReadOnlyVkMethod("wall.get", "service")
  );
});

test("service token is denied for market.get", () => {
  assert.throws(
    () => assertReadOnlyVkMethod("market.get", "service"),
    /not allowed/
  );
});

test("user token is allowed for market.get", () => {
  assert.doesNotThrow(() =>
    assertReadOnlyVkMethod("market.get", "user")
  );
});

test("unknown methods are denied", () => {
  assert.equal(getReadOnlyMethodPolicy("wall.post"), null);
  assert.throws(
    () => assertReadOnlyVkMethod("wall.post", "user"),
    /not allowlisted/
  );
});

test("VK token is sent in body, never in URL", async () => {
  let capturedUrl = "";
  let capturedBody = "";

  const fakeFetch = async (url, options) => {
    capturedUrl = String(url);
    capturedBody = String(options.body);
    return {
      ok: true,
      json: async () => ({ response: { object_id: 1 } })
    };
  };

  await callVkReadOnly({
    method: "utils.resolveScreenName",
    params: { screen_name: "palleta.store" },
    token: "SECRET_TEST_TOKEN",
    tokenType: "service",
    fetchImpl: fakeFetch
  });

  assert.equal(capturedUrl.includes("SECRET_TEST_TOKEN"), false);
  assert.equal(capturedBody.includes("SECRET_TEST_TOKEN"), true);
});
