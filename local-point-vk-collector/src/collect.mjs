import { chromium } from "playwright";
import path from "node:path";
import process from "node:process";
import {
  defaultEvidenceRoot,
  defaultProfileDir,
  ensureDir,
  isoNow,
  normalizeLinks,
  safeStamp,
  sanitizeUrl,
  sha256File,
  summarizeBlockedRequests,
  writeJson,
  writeText
} from "./lib.mjs";
import {
  STRICT_ALLOWED_METHODS,
  classifyTransportRequest
} from "./policy.mjs";

const targetUrl =
  process.env.VK_TARGET_URL || "https://vk.com/palleta.store";
const profileDir =
  process.env.VK_PROFILE_DIR || defaultProfileDir();
const evidenceRoot =
  process.env.VK_EVIDENCE_DIR || defaultEvidenceRoot();
const channel = process.env.VK_BROWSER_CHANNEL || "chrome";
const maxScrolls = Number(process.env.VK_MAX_SCROLLS || 12);
const scrollDelayMs = Number(process.env.VK_SCROLL_DELAY_MS || 1200);

const observedAt = isoNow();
const runDir = path.join(evidenceRoot, safeStamp(observedAt));
await ensureDir(runDir);

const blockedRequests = [];
let context;

try {
  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel,
    viewport: { width: 1440, height: 1000 }
  });

  // Strict transport boundary for the first pilot run.
  // Important: some SPA read operations may use POST. We do not infer safety.
  // Such requests are blocked, logged in sanitized form and reviewed later.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const classification = classifyTransportRequest({
      method: request.method(),
      url: sanitizeUrl(request.url()),
      resourceType: request.resourceType()
    });

    if (classification.decision === "ALLOW") {
      await route.continue();
      return;
    }

    blockedRequests.push({
      at: isoNow(),
      method: classification.method,
      url: classification.url,
      resourceType: classification.resourceType,
      policy: classification.policy
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
  const finalUrl = sanitizeUrl(page.url());
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

  const blockedSummary = summarizeBlockedRequests(blockedRequests);

  const snapshot = {
    schema_version: "0.1",
    collector: "local-point-vk-collector",
    collector_version: "0.1.0",
    organization_id: "palleta",
    platform: "VK",
    source_type: "browser_observation",
    target_url: sanitizeUrl(targetUrl),
    final_url: finalUrl,
    observed_at: observedAt,
    status,
    synthetic: false,
    local_storage: {
      browser_profile: "LOCAL_USER_STORAGE",
      evidence: "LOCAL_USER_STORAGE",
      committed_to_git: false
    },
    readonly_policy: {
      policy: "STRICT_TRANSPORT_READ_ONLY",
      allowed_methods: STRICT_ALLOWED_METHODS,
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
      "Some SPA read operations may use POST and can therefore be blocked in this strict first-run policy.",
      "No admin settings, messages or write actions are intentionally collected in v0.1.",
      "The policy must not be relaxed automatically."
    ]
  };

  const runSummary = {
    schema_version: "0.1",
    collector: "local-point-vk-collector",
    observed_at: observedAt,
    organization_id: "palleta",
    platform: "VK",
    status,
    target_url: sanitizeUrl(targetUrl),
    visible_text_chars: visibleText.length,
    links_count: links.length,
    blocked_non_read_requests: blockedRequests.length,
    blocked_endpoint_groups: blockedSummary.length,
    policy_relaxed: false,
    next_action:
      status === "BLOCKED"
        ? "REVIEW_BLOCKED_SUMMARY"
        : blockedRequests.length > 0
          ? "REVIEW_BLOCKED_SUMMARY_BEFORE_EXTRACTION"
          : "READY_FOR_EXTRACTION_CHECKPOINT"
  };

  const snapshotPath = path.join(runDir, "snapshot.json");
  const textPath = path.join(runDir, "visible-text.txt");
  const linksPath = path.join(runDir, "links.json");
  const blockedPath = path.join(runDir, "blocked-requests.json");
  const summaryPath = path.join(runDir, "blocked-summary.json");
  const runSummaryPath = path.join(runDir, "run-summary.json");

  await writeJson(snapshotPath, snapshot);
  await writeText(textPath, visibleText);
  await writeJson(linksPath, links);
  await writeJson(blockedPath, blockedRequests);
  await writeJson(summaryPath, blockedSummary);
  await writeJson(runSummaryPath, runSummary);

  const manifest = {
    schema_version: "0.1",
    observed_at: observedAt,
    files: {
      "snapshot.json": await sha256File(snapshotPath),
      "visible-text.txt": await sha256File(textPath),
      "links.json": await sha256File(linksPath),
      "blocked-requests.json": await sha256File(blockedPath),
      "blocked-summary.json": await sha256File(summaryPath),
      "run-summary.json": await sha256File(runSummaryPath)
    }
  };

  await writeJson(path.join(runDir, "manifest.sha256.json"), manifest);

  console.log("VK evidence run:", status);
  console.log("Output:", runDir);
  console.log("Visible text chars:", visibleText.length);
  console.log("Links:", links.length);
  console.log("Blocked non-read requests:", blockedRequests.length);
  console.log("Blocked endpoint groups:", blockedSummary.length);
  console.log("Next action:", runSummary.next_action);

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
    readonly_policy_relaxed: false,
    next_action: "REVIEW_FAILURE"
  };

  await writeJson(path.join(runDir, "failure.json"), failure);
  console.error("Collector blocked:", failure.reason);
  console.error("Output:", runDir);
  process.exitCode = 2;
} finally {
  if (context) await context.close().catch(() => {});
}
