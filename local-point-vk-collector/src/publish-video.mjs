import path from "node:path";
import process from "node:process";
import { readFile, stat } from "node:fs/promises";
import {
  PALLETTA_APPROVAL_TOKEN,
  PALLETTA_GROUP_ID,
  PALLETTA_OWNER_ID,
  assertPalletaPostMessage
} from "./publish-policy.mjs";
import {
  callVkPalletaWrite,
  resolveUploadedVideo,
  sha256Path,
  uploadPalletaVideo
} from "./vk-publish.mjs";
import { buildSnezhanaCaption } from "./palleta-post-template.mjs";

const token = process.env.VK_USER_TOKEN || "";
const videoPath = path.resolve(process.env.VK_VIDEO_PATH || "");
const approval = process.env.VK_PUBLISH_APPROVAL || "";
const factsPath = process.env.VK_PRODUCT_FACTS_PATH ? path.resolve(process.env.VK_PRODUCT_FACTS_PATH) : "";
const dryRun = process.env.VK_PUBLISH_DRY_RUN === "1";

async function preflight() {
  if (!token) throw new Error("VK_USER_TOKEN_MISSING");
  if (!process.env.VK_VIDEO_PATH) throw new Error("VK_VIDEO_PATH_MISSING");
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("VK_VIDEO_PATH_MUST_BE_MP4");
  }

  const info = await stat(videoPath);
  if (!info.isFile()) throw new Error("VK_VIDEO_PATH_NOT_FILE");
  if (info.size <= 0) throw new Error("VK_VIDEO_FILE_EMPTY");

  if (!factsPath) throw new Error("VK_PRODUCT_FACTS_PATH_MISSING");
  const factsInfo = await stat(factsPath);
  if (!factsInfo.isFile() || factsInfo.size <= 0) throw new Error("VK_PRODUCT_FACTS_FILE_INVALID");
  const rawFacts = await readFile(factsPath, "utf8");
  let facts;
  try {
    facts = JSON.parse(rawFacts);
  } catch {
    throw new Error("VK_PRODUCT_FACTS_JSON_INVALID");
  }
  const built = buildSnezhanaCaption(facts);
  const postText = built.caption;
  assertPalletaPostMessage(postText);

  const hash = await sha256Path(videoPath);
  return {
    file: videoPath,
    bytes: info.size,
    sha256: hash,
    group_id: PALLETTA_GROUP_ID,
    owner_id: PALLETTA_OWNER_ID,
    approval_present: approval === PALLETTA_APPROVAL_TOKEN,
    facts_path: factsPath,
    price_source: built.verified.price_source,
    stock_source: built.verified.stock_source,
    post_text_chars: postText.trim().length,
    post_text: postText,
    dry_run: dryRun
  };
}

try {
  const check = await preflight();
  console.log("PALLETTA_VK_PUBLISH_PREFLIGHT=PASS");
  console.log(JSON.stringify(check, null, 2));

  if (dryRun) {
    console.log("PALLETTA_VK_PUBLISH=PREPARED_NO_WRITE");
    process.exit(0);
  }

  if (approval !== PALLETTA_APPROVAL_TOKEN) {
    throw new Error("PALLETTA_PUBLISH_APPROVAL_REQUIRED");
  }

  const saveResponse = await callVkPalletaWrite({
    method: "video.save",
    params: {
      group_id: PALLETTA_GROUP_ID,
      wallpost: false
    },
    token,
    approval
  });

  if (!saveResponse?.upload_url) {
    throw new Error("VK_VIDEO_UPLOAD_URL_MISSING");
  }

  const uploadResponse = await uploadPalletaVideo({
    uploadUrl: saveResponse.upload_url,
    videoPath
  });

  const uploaded = resolveUploadedVideo({
    saveResponse,
    uploadResponse
  });

  const guid = "localpoint-palleta-video-" + check.sha256.slice(0, 32);

  const postResponse = await callVkPalletaWrite({
    method: "wall.post",
    params: {
      owner_id: PALLETTA_OWNER_ID,
      from_group: true,
      attachments: [uploaded.attachment],
      message: check.post_text,
      guid
    },
    token,
    approval
  });

  if (!postResponse?.post_id) {
    throw new Error("VK_WALL_POST_ID_MISSING");
  }

  console.log("PALLETTA_VK_PUBLISH=PASS");
  console.log("POST_ID=" + postResponse.post_id);
  console.log("ATTACHMENT=" + uploaded.attachment);
  console.log("GUID=" + guid);
} catch (error) {
  console.error("PALLETTA_VK_PUBLISH=BLOCKED");
  console.error("REASON=" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 2;
}
