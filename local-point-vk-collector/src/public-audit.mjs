import { chromium } from "playwright";
import path from "node:path";
import process from "node:process";
import {
  defaultEvidenceRoot,
  defaultProfileDir,
  ensureDir,
  isoNow,
  safeStamp,
  sanitizeUrl,
  sha256File,
  summarizeBlockedRequests,
  writeJson,
  writeText
} from "./lib.mjs";
import { classifyTransportRequest } from "./policy.mjs";

const profileDir = process.env.VK_PROFILE_DIR || defaultProfileDir();
const evidenceRoot = process.env.VK_EVIDENCE_DIR || defaultEvidenceRoot();
const channel = process.env.VK_BROWSER_CHANNEL || "chrome";
const observedAt = isoNow();
const runDir = path.join(evidenceRoot, "public-" + safeStamp(observedAt));
await ensureDir(runDir);

const blockedRequests = [];
const pages = [];
let context;

function safeName(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80);
}

async function capture(page, label, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2000);

  let previousHeight = 0;
  let stable = 0;
  for (let i = 0; i < 10; i += 1) {
    const height = await page.evaluate(() => document.body?.scrollHeight || 0).catch(() => 0);
    if (height === previousHeight) stable += 1;
    else stable = 0;
    previousHeight = height;
    if (stable >= 2) break;
    await page.evaluate(() => window.scrollTo(0, document.body?.scrollHeight || 0)).catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(250);

  const title = await page.title().catch(() => "");
  const finalUrl = sanitizeUrl(page.url());
  const text = await page.locator("body").innerText().catch(() => "");
  const html = await page.content().catch(() => "");
  const links = await page.locator("a[href]").evaluateAll(nodes =>
    nodes.map(node => ({
      raw_href: node.getAttribute("href") || "",
      href: node.href,
      text: (node.innerText || node.textContent || "").trim()
    }))
  ).catch(() => []);

  const safeLinks = [];
  const seen = new Set();
  const wallCandidates = new Set();
  const idCandidates = new Set();

  for (const item of links) {
    const raw = String(item.raw_href || "");
    const absolute = String(item.href || "");
    for (const source of [raw, absolute]) {
      const wallMatches = source.match(/wall-?(\d+)_\d+/gi) || [];
      for (const m of wallMatches) wallCandidates.add(m.replace(/^.*?(wall-?\d+_\d+).*$/i, "$1"));
      const idMatch = source.match(/(?:club|public|market-)(\d+)/i);
      if (idMatch) idCandidates.add(Number(idMatch[1]));
    }

    const href = sanitizeUrl(item.href);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    safeLinks.push({
      href,
      text: String(item.text || "").replace(/\s+/g, " ").slice(0, 500)
    });
  }

  const htmlWallMatches = html.match(/wall-?(\d+)_\d+/gi) || [];
  for (const m of htmlWallMatches) wallCandidates.add(m);

  const htmlIdMatches = html.match(/(?:club|public|market-)(\d+)/gi) || [];
  for (const m of htmlIdMatches) {
    const id = Number((m.match(/(\d+)/) || [])[1]);
    if (id) idCandidates.add(id);
  }

  const screenshot = path.join(runDir, safeName(label) + ".png");
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});

  const item = {
    label,
    requested_url: sanitizeUrl(url),
    final_url: finalUrl,
    title,
    visible_text_chars: text.length,
    links_count: safeLinks.length,
    wall_candidates: [...wallCandidates],
    id_candidates: [...idCandidates],
    text,
    links: safeLinks,
    screenshot: path.basename(screenshot)
  };
  pages.push(item);
  return item;
}

try {
  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel,
    viewport: { width: 1440, height: 1000 }
  });

  await context.route("**/*", async route => {
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

  const seedPages = [
    ["desktop-main", "https://vk.com/palleta.store"],
    ["mobile-main", "https://m.vk.com/palleta.store"],
    ["mobile-offset-10", "https://m.vk.com/palleta.store?offset=10"],
    ["mobile-offset-20", "https://m.vk.com/palleta.store?offset=20"]
  ];

  for (const [label, url] of seedPages) {
    await capture(page, label, url);
  }

  const wallLinks = new Set();

  const mainPage = pages.find(p => p.label === "desktop-main");
  const communityIdEvidence = [];
  if (mainPage) {
    for (const link of mainPage.links || []) {
      const href = String(link.href || "");
      for (const re of [/reviews-(\d+)/i, /\/gim(\d+)/i, /\/cart(\d+)/i]) {
        const m = href.match(re);
        if (m) {
          communityIdEvidence.push({
            source: href,
            id: Number(m[1])
          });
        }
      }
    }
  }

  const evidenceIds = [...new Set(communityIdEvidence.map(x => x.id))];
  const groupId = evidenceIds.length === 1 ? evidenceIds[0] : null;

  for (const p of pages) {
    for (const href of p.links) {
      if (/\/wall-?\d+_\d+$/i.test(href.href)) {
        const m = href.href.match(/\/wall-(\d+)_\d+$/i);
        if (groupId && m && Number(m[1]) === groupId) wallLinks.add(href.href);
      }
    }
    for (const wall of p.wall_candidates || []) {
      const m = wall.match(/wall-(\d+)_\d+/i);
      if (groupId && m && Number(m[1]) === groupId) {
        wallLinks.add("https://vk.com/" + wall);
      }
    }
  }

  const wallList = [...wallLinks].slice(0, 20);

  for (let i = 0; i < Math.min(wallList.length, 10); i += 1) {
    await capture(page, "wall-" + (i + 1), wallList[i]);
  }

  if (groupId) {
    await capture(page, "market-desktop", "https://vk.com/market-" + groupId);
    await capture(page, "market-mobile", "https://m.vk.com/market-" + groupId);
  }

  const summary = {
    schema_version: "0.3",
    collector: "local-point-vk-collector",
    collector_mode: "PUBLIC_BROWSER_GET_ONLY",
    observed_at: observedAt,
    organization_id: "palleta",
    target: "palleta.store",
    status: "COLLECTED_READ_ONLY",
    group_id: groupId,
    group_id_status: groupId ? "CONFIRMED_FROM_SELF_LINKS" : "UNVERIFIED",
    group_id_evidence: communityIdEvidence,
    pages_captured: pages.length,
    wall_links_found: wallList.length,
    blocked_non_read_requests: blockedRequests.length,
    policy_relaxed: false,
    api_gate: {
      status: "BLOCKED_BY_TOKEN_PROFILE_TYPE",
      last_error: "VK API error 1051 for utils.resolveScreenName"
    }
  };

  const compact = pages.map(p => ({
    label: p.label,
    requested_url: p.requested_url,
    final_url: p.final_url,
    title: p.title,
    visible_text_chars: p.visible_text_chars,
    links_count: p.links_count,
    screenshot: p.screenshot
  }));

  await writeJson(path.join(runDir, "summary.json"), summary);
  await writeJson(path.join(runDir, "pages-index.json"), compact);
  await writeJson(path.join(runDir, "blocked-summary.json"), summarizeBlockedRequests(blockedRequests));
  await writeJson(path.join(runDir, "blocked-requests.json"), blockedRequests);

  for (const p of pages) {
    await writeText(path.join(runDir, safeName(p.label) + ".txt"), p.text);
    await writeJson(path.join(runDir, safeName(p.label) + "-links.json"), p.links);
  }

  const manifestFiles = ["summary.json", "pages-index.json", "blocked-summary.json", "blocked-requests.json"];
  const manifest = { schema_version: "0.3", observed_at: observedAt, files: {} };
  for (const f of manifestFiles) {
    manifest.files[f] = await sha256File(path.join(runDir, f));
  }
  await writeJson(path.join(runDir, "manifest.sha256.json"), manifest);

  console.log("VK public browser audit: COLLECTED_READ_ONLY");
  console.log("Output:", runDir);
  console.log("Pages captured:", pages.length);
  console.log("Wall links found:", wallList.length);
  console.log("Group ID:", groupId ?? "NOT_FOUND");
  console.log("Group ID status:", groupId ? "CONFIRMED_FROM_SELF_LINKS" : "UNVERIFIED");
  console.log("Blocked non-read requests:", blockedRequests.length);
  console.log("API gate: BLOCKED_BY_TOKEN_PROFILE_TYPE");
} catch (error) {
  console.error("VK public browser audit blocked:", error instanceof Error ? error.message : String(error));
  console.error("Output:", runDir);
  process.exitCode = 2;
} finally {
  if (context) await context.close().catch(() => {});
}
