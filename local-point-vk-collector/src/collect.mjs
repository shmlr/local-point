import { chromium } from "playwright";
import path from "node:path";
import process from "node:process";
import {
  ensureDir,
  isoNow,
  normalizeLinks,
  safeStamp,
  sha256File,
  writeJson,
  writeText
} from "./lib.mjs";

const targetUrl =
  process.env.VK_TARGET_URL || "https://vk.com/palleta.store";
const profileDir = path.resolve(
  process.env.VK_PROFILE_DIR || ".local/vk-profile"
);
const evidenceRoot = path.resolve(
  process.env.VK_EVIDENCE_DIR || "evidence"
);
const channel = process.env.VK_BROWSER_CHANNEL || "chrome";
const maxScrolls = Number(process.env.VK_MAX_SCROLLS || 12);
const scrollDelayMs = Number(process.env.VK_SCROLL_DELAY_MS || 1200);

const observedAt = isoNow();
const runDir = path.join(evidenceRoot, safeStamp(observedAt));
await ensureDir(runDir);

const blockedRequests = [];
let context;

function isReadOnlyMethod(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

try {
  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel,
    viewport: { width: 1440, height: 1000 }
  });

  // Hard safety boundary for audit runs:
  // no POST/PUT/PATCH/DELETE network request is allowed.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();

    if (isReadOnlyMethod(method)) {
      await route.continue();
      return;
    }

    blockedRequests.push({
      at: isoNow(),
      method,
      url: request.url(),
      resourceType: request.resourceType()
    });

    await route.abort("blockedbyclient");
  });

  const page = context.pages()[0] || await context.newPage();

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });

  await page.waitForTimeout(2500);

  let stableRounds = 0;
  let previousHeight = 0;

  for (let i = 0; i < maxScrolls; i += 1) {
    const height = await page.evaluate(() => document.body?.scrollHeight || 0);

    if (height === previousHeight) stableRounds += 1;
    else stableRounds = 0;

    previousHeight = height;
    if (stableRounds >= 2) break;

    await page.evaluate(() => {
      window.scrollTo(0, document.body?.scrollHeight || 0);
    });
    await page.waitForTimeout(scrollDelayMs);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const title = await page.title();
  const finalUrl = page.url();
  const visibleText = await page.locator("body").innerText().catch(() => "");

  const links = normalizeLinks(
    await page.locator("a[href]").evaluateAll((nodes) =>
      nodes.map((node) => ({
        href: node.href,
        text: node.innerText || node.textContent || ""
      }))
    ).catch(() => [])
  );

  const blockerPattern =
    /(captcha|проверка безопасности|доступ ограничен|access denied|site unavailable)/i;
  const blockerDetected = blockerPattern.test(title + "\n" + visibleText);
  const tooLittleContent = visibleText.trim().length < 200;

  const status =
    blockerDetected || tooLittleContent ? "BLOCKED" : "COLLECTED_READ_ONLY";

  const snapshot = {
    schema_version: "0.1",
    collector: "local-point-vk-collector",
    collector_version: "0.1.0",
    organization_id: "palleta",
    platform: "VK",
    source_type: "browser_observation",
    target_url: targetUrl,
    final_url: finalUrl,
    observed_at: observedAt,
    status,
    synthetic: false,
    readonly_policy: {
      allowed_methods: ["GET", "HEAD", "OPTIONS"],
      blocked_non_read_requests: blockedRequests.length,
      policy_relaxed: false
    },
    page: {
      title,
      visible_text_chars: visibleText.length,
      links_count: links.length
    },
    limitations: [
      "Platform observation is not automatically a current business fact.",
      "No POST/PUT/PATCH/DELETE request was allowed.",
      "No admin settings, messages or write actions are intentionally collected in v0.1.",
      "If VK requires POST-based reads, this run may be partial or blocked; policy must not be relaxed automatically."
    ]
  };

  const snapshotPath = path.join(runDir, "snapshot.json");
  const textPath = path.join(runDir, "visible-text.txt");
  const linksPath = path.join(runDir, "links.json");
  const blockedPath = path.join(runDir, "blocked-requests.json");

  await writeJson(snapshotPath, snapshot);
  await writeText(textPath, visibleText);
  await writeJson(linksPath, links);
  await writeJson(blockedPath, blockedRequests);

  const manifest = {
    schema_version: "0.1",
    observed_at: observedAt,
    files: {
      "snapshot.json": await sha256File(snapshotPath),
      "visible-text.txt": await sha256File(textPath),
      "links.json": await sha256File(linksPath),
      "blocked-requests.json": await sha256File(blockedPath)
    }
  };

  await writeJson(path.join(runDir, "manifest.sha256.json"), manifest);

  console.log("VK evidence run:", status);
  console.log("Output:", runDir);
  console.log("Visible text chars:", visibleText.length);
  console.log("Links:", links.length);
  console.log("Blocked non-read requests:", blockedRequests.length);

  if (status === "BLOCKED") {
    process.exitCode = 2;
  }
} catch (error) {
  const failure = {
    schema_version: "0.1",
    collector: "local-point-vk-collector",
    observed_at: observedAt,
    status: "BLOCKED",
    reason: error instanceof Error ? error.message : String(error),
    readonly_policy_relaxed: false
  };

  await writeJson(path.join(runDir, "failure.json"), failure);
  console.error("Collector blocked:", failure.reason);
  console.error("Output:", runDir);
  process.exitCode = 2;
} finally {
  if (context) await context.close().catch(() => {});
}
