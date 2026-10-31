import { renderPalletaApprovedReelTemplate } from "./palleta-post-template.mjs";
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

  const lines = text.split(/\r?\n/);
  const productLine = lines.find(line => /^🌾 МУКА СНЕЖАНА, 5 КГ - \d{1,6},\d{2} ₽$/.test(line.trim()));
  if (!productLine) {
    throw new Error("PALLETTA_POST_TEXT_PRODUCT_LINE_INVALID");
  }

  const expected = renderPalletaApprovedReelTemplate(productLine.trim()).trim();
  if (text !== expected) {
    throw new Error("PALLETTA_POST_TEXT_NOT_APPROVED_TEMPLATE");
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
