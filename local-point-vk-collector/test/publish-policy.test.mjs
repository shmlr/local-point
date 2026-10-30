import test from "node:test";
import assert from "node:assert/strict";
import {
  PALLETTA_APPROVAL_TOKEN,
  PALLETTA_GROUP_ID,
  PALLETTA_OWNER_ID,
  assertPalletaApproval,
  assertPalletaWriteMethod
} from "../src/publish-policy.mjs";
import { callVkPalletaWrite } from "../src/vk-publish.mjs";

test("approval token is mandatory", () => {
  assert.throws(() => assertPalletaApproval(""), /APPROVAL_REQUIRED/);
  assert.doesNotThrow(() => assertPalletaApproval(PALLETTA_APPROVAL_TOKEN));
});

test("video.save is restricted to Palleta and wallpost false", () => {
  assert.doesNotThrow(() =>
    assertPalletaWriteMethod("video.save", "user", {
      group_id: PALLETTA_GROUP_ID,
      wallpost: false
    })
  );

  assert.throws(() =>
    assertPalletaWriteMethod("video.save", "user", {
      group_id: 1,
      wallpost: false
    }),
    /GROUP_ID_BLOCKED/
  );

  assert.throws(() =>
    assertPalletaWriteMethod("video.save", "user", {
      group_id: PALLETTA_GROUP_ID,
      wallpost: true
    }),
    /WALLPOST_MUST_BE_FALSE/
  );
});

test("wall.post allows one Palleta video attachment only", () => {
  assert.doesNotThrow(() =>
    assertPalletaWriteMethod("wall.post", "user", {
      owner_id: PALLETTA_OWNER_ID,
      from_group: true,
      attachments: ["video-197164485_123"],
      guid: "localpoint-palleta-video-test"
    })
  );

  assert.throws(() =>
    assertPalletaWriteMethod("wall.post", "user", {
      owner_id: PALLETTA_OWNER_ID,
      from_group: true,
      attachments: ["photo-197164485_123"],
      guid: "localpoint-palleta-video-test"
    }),
    /ATTACHMENT_BLOCKED/
  );
});

test("other write methods remain blocked", () => {
  assert.throws(
    () => assertPalletaWriteMethod("wall.delete", "user", {}),
    /not allowlisted/
  );
});

test("write token is sent only in Authorization header", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  let capturedAuthorization = "";

  const fakeFetch = async (url, options) => {
    capturedUrl = String(url);
    capturedBody = String(options.body);
    capturedAuthorization = String(options.headers.authorization || "");
    return {
      ok: true,
      json: async () => ({ response: { upload_url: "https://upload.example/" } })
    };
  };

  await callVkPalletaWrite({
    method: "video.save",
    params: {
      group_id: PALLETTA_GROUP_ID,
      wallpost: false
    },
    token: "SECRET_TEST_TOKEN",
    approval: PALLETTA_APPROVAL_TOKEN,
    fetchImpl: fakeFetch
  });

  assert.equal(capturedUrl.includes("SECRET_TEST_TOKEN"), false);
  assert.equal(capturedBody.includes("SECRET_TEST_TOKEN"), false);
  assert.equal(capturedAuthorization, "Bearer SECRET_TEST_TOKEN");
});
