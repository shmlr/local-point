import { openAsBlob } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { VK_API_VERSION } from "./api-policy.mjs";
import {
  PALLETTA_GROUP_ID,
  assertPalletaApproval,
  assertPalletaWriteMethod
} from "./publish-policy.mjs";

const API_ROOT = "https://api.vk.com/method";

function encodeParams(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) body.set(key, value.join(","));
    else if (typeof value === "boolean") body.set(key, value ? "1" : "0");
    else body.set(key, String(value));
  }
  body.set("v", VK_API_VERSION);
  return body;
}

export async function callVkPalletaWrite({
  method,
  params = {},
  token,
  approval,
  fetchImpl = fetch
}) {
  if (!token) throw new Error(`Missing VK user token for ${method}`);
  assertPalletaApproval(approval);
  assertPalletaWriteMethod(method, "user", params);

  const response = await fetchImpl(`${API_ROOT}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "authorization": `Bearer ${token}`,
      "user-agent": "LocalPoint-VK-Palleta-Publisher/0.1"
    },
    body: encodeParams(params)
  });

  if (!response.ok) {
    throw new Error(`VK API HTTP ${response.status} for ${method}`);
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new Error(
      `VK API error ${payload.error.error_code ?? "unknown"} for ${method}: ${payload.error.error_msg ?? "unknown"}`
    );
  }
  return payload?.response;
}

export async function uploadPalletaVideo({
  uploadUrl,
  videoPath,
  fetchImpl = fetch
}) {
  if (!uploadUrl) throw new Error("Missing VK video upload URL");
  if (!videoPath) throw new Error("Missing video path");

  const blob = await openAsBlob(videoPath, { type: "video/mp4" });
  const form = new FormData();
  form.set("video_file", blob, "palleta-video.mp4");

  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(`VK video upload HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new Error(`VK video upload error: ${JSON.stringify(payload.error)}`);
  }
  return payload;
}

export async function sha256Path(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

export function resolveUploadedVideo({ saveResponse, uploadResponse }) {
  const videoId = Number(uploadResponse?.video_id ?? saveResponse?.video_id ?? 0);
  const ownerId = Number(uploadResponse?.owner_id ?? saveResponse?.owner_id ?? -PALLETTA_GROUP_ID);

  if (!Number.isInteger(videoId) || videoId <= 0) {
    throw new Error("VK_VIDEO_ID_MISSING_AFTER_UPLOAD");
  }
  if (ownerId !== -PALLETTA_GROUP_ID) {
    throw new Error(`VK_VIDEO_OWNER_MISMATCH owner_id=${ownerId}`);
  }

  return {
    videoId,
    ownerId,
    attachment: `video${ownerId}_${videoId}`
  };
}
