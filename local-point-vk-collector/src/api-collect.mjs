import path from "node:path";
import process from "node:process";
import {
  defaultEvidenceRoot,
  ensureDir,
  isoNow,
  safeStamp,
  sha256File,
  writeJson
} from "./lib.mjs";
import { callVkReadOnly } from "./vk-api.mjs";

const screenName = process.env.VK_SCREEN_NAME || "palleta.store";
const serviceToken = process.env.VK_SERVICE_TOKEN || "";
const userToken = process.env.VK_USER_TOKEN || "";
const evidenceRoot =
  process.env.VK_EVIDENCE_DIR || defaultEvidenceRoot();

const observedAt = isoNow();
const runDir = path.join(
  evidenceRoot,
  `api-${safeStamp(observedAt)}`
);

await ensureDir(runDir);

const result = {
  schema_version: "0.2",
  collector: "local-point-vk-collector",
  collector_mode: "OFFICIAL_VK_API_READ_ONLY",
  observed_at: observedAt,
  organization_id: "palleta",
  platform: "VK",
  target_screen_name: screenName,
  api_version: "5.199",
  policy_relaxed: false,
  tokens: {
    service: serviceToken ? "PRESENT" : "MISSING",
    user: userToken ? "PRESENT" : "MISSING"
  },
  sources: {},
  gaps: []
};

if (!serviceToken) {
  result.status = "SOURCE_DATA_REQUIRED";
  result.gaps.push({
    field: "VK_SERVICE_TOKEN",
    reason:
      "Required for official read-only community/profile/wall/address collection."
  });

  if (!userToken) {
    result.gaps.push({
      field: "VK_USER_TOKEN",
      reason:
        "Required only for market.get product extraction according to official VK API schema."
    });
  }

  await writeJson(path.join(runDir, "api-summary.json"), result);
  console.log("VK API evidence: SOURCE_DATA_REQUIRED");
  console.log("Service token: MISSING");
  console.log("User token:", userToken ? "PRESENT" : "MISSING");
  console.log("Output:", runDir);
  process.exitCode = 3;
} else {
  try {
    const resolved = await callVkReadOnly({
      method: "utils.resolveScreenName",
      params: { screen_name: screenName },
      token: serviceToken,
      tokenType: "service"
    });

    result.sources.resolve = resolved;

    if (!resolved?.object_id || resolved?.type !== "group") {
      throw new Error(
        `Expected VK group for ${screenName}, received type=${resolved?.type ?? "unknown"}`
      );
    }

    const groupId = Number(resolved.object_id);
    const ownerId = -groupId;

    const [group, addresses, wall] = await Promise.all([
      callVkReadOnly({
        method: "groups.getById",
        params: {
          group_id: groupId,
          fields: [
            "description",
            "contacts",
            "site",
            "status",
            "verified",
            "members_count",
            "activity",
            "addresses",
            "city",
            "country"
          ]
        },
        token: serviceToken,
        tokenType: "service"
      }),
      callVkReadOnly({
        method: "groups.getAddresses",
        params: {
          group_id: groupId,
          count: 100
        },
        token: serviceToken,
        tokenType: "service"
      }),
      callVkReadOnly({
        method: "wall.get",
        params: {
          owner_id: ownerId,
          domain: screenName,
          count: 100,
          filter: "owner",
          extended: true
        },
        token: serviceToken,
        tokenType: "service"
      })
    ]);

    result.sources.group = group;
    result.sources.addresses = addresses;
    result.sources.wall = wall;

    if (userToken) {
      result.sources.market = await callVkReadOnly({
        method: "market.get",
        params: {
          owner_id: ownerId,
          count: 200,
          extended: true
        },
        token: userToken,
        tokenType: "user"
      });
    } else {
      result.gaps.push({
        field: "MARKET_ITEMS",
        reason:
          "VK_USER_TOKEN missing. market.get is not called with service token."
      });
    }

    result.status =
      result.gaps.length === 0
        ? "COLLECTED_READ_ONLY"
        : "COLLECTED_READ_ONLY_PARTIAL";

    result.ids = {
      group_id: groupId,
      owner_id: ownerId
    };

    const output = path.join(runDir, "api-evidence.json");
    await writeJson(output, result);

    const manifest = {
      schema_version: "0.2",
      observed_at: observedAt,
      files: {
        "api-evidence.json": await sha256File(output)
      }
    };

    await writeJson(
      path.join(runDir, "manifest.sha256.json"),
      manifest
    );

    console.log("VK API evidence:", result.status);
    console.log("Group ID:", groupId);
    console.log("Output:", runDir);
    console.log("Market:", userToken ? "COLLECTED" : "SOURCE_DATA_REQUIRED");
  } catch (error) {
    result.status = "BLOCKED";
    result.error =
      error instanceof Error ? error.message : String(error);

    await writeJson(
      path.join(runDir, "api-failure.json"),
      result
    );

    console.error("VK API collector blocked:", result.error);
    console.error("Output:", runDir);
    process.exitCode = 2;
  }
}
