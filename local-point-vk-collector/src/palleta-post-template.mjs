export const PALLETTA_TEMPLATE_VERSION = "2026-10-23";
export const PALLETTA_SNEZHANA_PRODUCT_KEY = "snezhana_flour_5kg";

const STATIC_LINES = Object.freeze([
  "ВСЕГДА НИЗКИЕ ЦЕНЫ!",
  "",
  "{{PRODUCT_LINE}}",
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
]);

export function renderPalletaApprovedReelTemplate(productLine) {
  const line = String(productLine || "").trim();
  if (!line) throw new Error("PALLETTA_PRODUCT_LINE_REQUIRED");
  return STATIC_LINES.map(item => item === "{{PRODUCT_LINE}}" ? line : item).join("\n");
}

function assertFreshTimestamp(value, label, nowMs = Date.now()) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) throw new Error(label + "_TIMESTAMP_REQUIRED");
  const ageMs = nowMs - parsed;
  if (ageMs < -5 * 60 * 1000) throw new Error(label + "_TIMESTAMP_IN_FUTURE");
  if (ageMs > 24 * 60 * 60 * 1000) throw new Error(label + "_STALE");
}

export function validateSnezhanaFacts(facts, nowMs = Date.now()) {
  const f = facts && typeof facts === "object" ? facts : {};
  if (f.product_key !== PALLETTA_SNEZHANA_PRODUCT_KEY) {
    throw new Error("PALLETTA_PRODUCT_KEY_BLOCKED");
  }

  const price = String(f.price_rub ?? "").trim().replace(".", ",");
  if (!/^\d{1,6},\d{2}$/.test(price)) {
    throw new Error("PALLETTA_PRICE_REQUIRED");
  }

  if (f.price_type !== "retail") {
    throw new Error("PALLETTA_PRICE_TYPE_NOT_APPROVED");
  }

  if (f.stock_confirmed !== true) {
    throw new Error("PALLETTA_STOCK_NOT_CONFIRMED");
  }

  const allowedPriceSources = new Set(["1C", "cash_register", "VK", "Instagram", "owner_confirmed"]);
  const allowedStockSources = new Set(["1C", "cash_register", "owner_confirmed"]);

  if (!allowedPriceSources.has(f.price_source)) {
    throw new Error("PALLETTA_PRICE_SOURCE_NOT_APPROVED");
  }
  if (!allowedStockSources.has(f.stock_source)) {
    throw new Error("PALLETTA_STOCK_SOURCE_NOT_APPROVED");
  }

  assertFreshTimestamp(f.price_verified_at, "PALLETTA_PRICE", nowMs);
  assertFreshTimestamp(f.stock_verified_at, "PALLETTA_STOCK", nowMs);

  return {
    product_key: PALLETTA_SNEZHANA_PRODUCT_KEY,
    price_rub: price,
    price_type: "retail",
    stock_confirmed: true,
    price_source: f.price_source,
    stock_source: f.stock_source,
    price_verified_at: f.price_verified_at,
    stock_verified_at: f.stock_verified_at
  };
}

export function buildSnezhanaCaption(facts, nowMs = Date.now()) {
  const verified = validateSnezhanaFacts(facts, nowMs);
  const productLine = `🌾 МУКА СНЕЖАНА, 5 КГ - ${verified.price_rub} ₽`;
  return {
    caption: renderPalletaApprovedReelTemplate(productLine),
    verified
  };
}
