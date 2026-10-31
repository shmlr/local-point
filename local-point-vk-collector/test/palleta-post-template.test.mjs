import test from "node:test";
import assert from "node:assert/strict";
import {
  PALLETTA_SNEZHANA_PRODUCT_KEY,
  buildSnezhanaCaption,
  renderPalletaApprovedReelTemplate,
  validateSnezhanaFacts
} from "../src/palleta-post-template.mjs";

test("approved Reel template preserves exact static text", () => {
  const text = renderPalletaApprovedReelTemplate("TEST_PRODUCT_LINE");
  assert.match(text, /^ВСЕГДА НИЗКИЕ ЦЕНЫ!/);
  assert.match(text, /Махачкала, проспект Петра I, 49\./);
  assert.match(text, /Приходите в «Паллету»!/);
  assert.match(text, /Без торговой наценки продаётся часть ассортимента/);
  assert.equal(text.includes("TEST_PRODUCT_LINE"), true);
});

test("Snezhana facts fail closed when price or stock are not confirmed", () => {
  const now = Date.parse("2026-10-31T10:00:00Z");
  assert.throws(() => validateSnezhanaFacts({
    product_key: PALLETTA_SNEZHANA_PRODUCT_KEY,
    price_rub: null,
    price_type: "retail",
    stock_confirmed: false
  }, now), /PRICE_REQUIRED/);
});

test("Snezhana facts require fresh approved sources", () => {
  const now = Date.parse("2026-10-31T10:00:00Z");
  // Test sentinel only, not a factual Snezhana price.
  const facts = {
    product_key: PALLETTA_SNEZHANA_PRODUCT_KEY,
    price_rub: "99999,99",
    price_type: "retail",
    stock_confirmed: true,
    price_source: "1C",
    stock_source: "1C",
    price_verified_at: "2026-10-31T09:30:00Z",
    stock_verified_at: "2026-10-31T09:30:00Z"
  };
  const built = buildSnezhanaCaption(facts, now);
  assert.match(built.caption, /🌾 МУКА СНЕЖАНА, 5 КГ - 99999,99 ₽/);
  assert.equal(built.verified.stock_confirmed, true);

  assert.throws(() => validateSnezhanaFacts({
    ...facts,
    price_verified_at: "2026-10-29T09:30:00Z"
  }, now), /PRICE_STALE/);
});
