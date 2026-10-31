import test from "node:test";
import assert from "node:assert/strict";
import {
  PALLETTA_APPROVAL_TOKEN,
  PALLETTA_GROUP_ID,
  PALLETTA_OWNER_ID,
  assertPalletaApproval,
  assertPalletaPostMessage,
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

// Unit-test sentinel only. This is not a factual Snezhana price and is never published.
const TEST_PRODUCT_LINE = "🌾 МУКА СНЕЖАНА, 5 КГ - 99999,99 ₽";
const VALID_POST_TEXT = [
  "ВСЕГДА НИЗКИЕ ЦЕНЫ!",
  "",
  TEST_PRODUCT_LINE,
  "",
  "Зачем часто ездить за продуктами, если можно взять всё необходимое сразу?",
  "",
  "В «Паллете» можно покупать так, как удобно вам:",
  "",
  "✅ Поштучно, если нужно немного.",
  "✅ Упаковками, если покупаете в запас.",
  "✅ В большом количестве для дома, семьи или бизнеса.",
  "",
  "🛍️ Широкий ассортимент, низкие цены и возможность купить столько, сколько нужно!",
  "",
  "📍 Махачкала, проспект Петра I, 49.",
  "",
  "Приходите в «Паллету»!",
  "",
  "*Без торговой наценки продаётся часть ассортимента. Перечень товаров может меняться. Цены и наличие актуальны на момент публикации.*"
].join("\n");

test("approved Palleta post text is exact-template only", () => {
  assert.doesNotThrow(() => assertPalletaPostMessage(VALID_POST_TEXT));
  assert.throws(() => assertPalletaPostMessage(""), /POST_TEXT_REQUIRED/);
  assert.throws(
    () => assertPalletaPostMessage(VALID_POST_TEXT + "\nНовая рекламная фраза"),
    /NOT_APPROVED_TEMPLATE/
  );
  assert.throws(
    () => assertPalletaPostMessage(VALID_POST_TEXT.replace("99999,99 ₽", "цена уточняется")),
    /PRODUCT_LINE_INVALID/
  );
});

test("wall.post allows one Palleta video attachment and exact approved text only", () => {
  assert.doesNotThrow(() =>
    assertPalletaWriteMethod("wall.post", "user", {
      owner_id: PALLETTA_OWNER_ID,
      from_group: true,
      attachments: ["video-197164485_123"],
      message: VALID_POST_TEXT,
      guid: "localpoint-palleta-video-test"
    })
  );

  assert.throws(() =>
    assertPalletaWriteMethod("wall.post", "user", {
      owner_id: PALLETTA_OWNER_ID,
      from_group: true,
      attachments: ["photo-197164485_123"],
      message: VALID_POST_TEXT,
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
