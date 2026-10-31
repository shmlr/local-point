export const PALLETTA_GROUP_ID = 197164485;
export const PALLETTA_OWNER_ID = -197164485;
export const PALLETTA_SCREEN_NAME = "palleta.store";
export const PALLETTA_APPROVAL_TOKEN = "PALLETTA_VIDEO_ONCE";

export const VK_PALLETTA_WRITE_METHODS = Object.freeze({
  "video.save": {
    token_types: ["user"],
    purpose: "Create one upload session for a Palleta community video"
  },
  "wall.post": {
    token_types: ["user"],
    purpose: "Publish one approved text + one video attachment to the Palleta community wall"
  }
});

function normalizeBool(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0" || value === undefined || value === null) return false;
  return Boolean(value);
}

export function assertPalletaPostMessage(message) {
  const text = String(message || "").trim();
  if (!text) throw new Error("PALLETTA_POST_TEXT_REQUIRED");

  const required = [
    "ВСЕГДА НИЗКИЕ ЦЕНЫ!",
    "Снежана",
    "5 кг",
    "Махачкала, проспект Петра I, 49.",
    "Приходите в «Паллету»!",
    "Без торговой наценки продаётся часть ассортимента.",
    "Перечень товаров может меняться.",
    "Цены и наличие актуальны на момент публикации."
  ];

  for (const phrase of required) {
    if (!text.includes(phrase)) {
      throw new Error("PALLETTA_POST_TEXT_MISSING_REQUIRED_PHRASE:" + phrase);
    }
  }

  if (!/\d+[,.]\d{2}\s*₽/.test(text)) {
    throw new Error("PALLETTA_POST_TEXT_PRICE_REQUIRED");
  }

  const forbidden = [
    /закупочн/i,
    /себестоим/i,
    /\bмарж/i,
    /самая низкая цена/i,
    /нигде дешевле/i
  ];
  for (const re of forbidden) {
    if (re.test(text)) throw new Error("PALLETTA_POST_TEXT_FORBIDDEN_CLAIM");
  }

  return text;
}

function assertAllowedKeys(params, allowed) {
  const extra = Object.keys(params || {}).filter(key => !allowed.includes(key));
  if (extra.length) {
    throw new Error(`VK write params not allowlisted: ${extra.join(",")}`);
  }
}

export function assertPalletaApproval(value) {
  if (value !== PALLETTA_APPROVAL_TOKEN) {
    throw new Error("PALLETTA_PUBLISH_APPROVAL_REQUIRED");
  }
}

export function assertPalletaWriteMethod(method, tokenType, params = {}) {
  const policy = VK_PALLETTA_WRITE_METHODS[method];
  if (!policy) throw new Error(`VK write method is not allowlisted: ${method}`);
  if (!policy.token_types.includes(tokenType)) {
    throw new Error(`VK token type ${tokenType} is not allowed for ${method}`);
  }

  if (method === "video.save") {
    assertAllowedKeys(params, ["group_id", "wallpost"]);
    if (Number(params.group_id) !== PALLETTA_GROUP_ID) {
      throw new Error("VIDEO_SAVE_GROUP_ID_BLOCKED");
    }
    if (normalizeBool(params.wallpost)) {
      throw new Error("VIDEO_SAVE_WALLPOST_MUST_BE_FALSE");
    }
  }

  if (method === "wall.post") {
    assertAllowedKeys(params, ["owner_id", "from_group", "attachments", "guid", "message"]);
    if (Number(params.owner_id) !== PALLETTA_OWNER_ID) {
      throw new Error("WALL_POST_OWNER_ID_BLOCKED");
    }
    if (!normalizeBool(params.from_group)) {
      throw new Error("WALL_POST_FROM_GROUP_REQUIRED");
    }
    if (!Array.isArray(params.attachments) || params.attachments.length !== 1) {
      throw new Error("WALL_POST_SINGLE_VIDEO_ATTACHMENT_REQUIRED");
    }
    const attachment = String(params.attachments[0] || "");
    const re = new RegExp(`^video-${PALLETTA_GROUP_ID}_[0-9]+$`);
    if (!re.test(attachment)) {
      throw new Error("WALL_POST_ATTACHMENT_BLOCKED");
    }
    if (!String(params.guid || "").startsWith("localpoint-palleta-video-")) {
      throw new Error("WALL_POST_GUID_REQUIRED");
    }
    assertPalletaPostMessage(params.message);
  }

  return policy;
}
