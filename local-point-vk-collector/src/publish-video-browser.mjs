import { chromium } from "playwright";
import path from "node:path";
import process from "node:process";
import { stat } from "node:fs/promises";
import {
  defaultProfileDir,
  isoNow
} from "./lib.mjs";
import {
  PALLETTA_APPROVAL_TOKEN,
  PALLETTA_GROUP_ID,
  assertPalletaApproval
} from "./publish-policy.mjs";
import { sha256Path } from "./vk-publish.mjs";

const targetUrl = "https://vk.com/palleta.store";
const profileDir = process.env.VK_PROFILE_DIR || defaultProfileDir();
const channel = process.env.VK_BROWSER_CHANNEL || "chrome";
const videoPath = path.resolve(process.env.VK_VIDEO_PATH || "");
const approval = process.env.VK_PUBLISH_APPROVAL || "";
const dryRun = process.env.VK_PUBLISH_DRY_RUN === "1";

function isVkUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "vk.com" || host === "www.vk.com" || host === "vk.ru" || host === "www.vk.ru";
  } catch {
    return false;
  }
}


async function getPalletaWallLinks(page) {
  const hrefs = await page.locator("a[href]").evaluateAll(nodes =>
    nodes.map(node => String(node.href || ""))
  ).catch(() => []);
  const re = new RegExp("/wall-" + PALLETTA_GROUP_ID + "_[0-9]+(?:[/?#]|$)", "i");
  return [...new Set(hrefs.filter(href => re.test(href)))];
}

async function verifyPalleta(page) {
  const current = page.url();
  if (!isVkUrl(current)) throw new Error("BROWSER_LEFT_VK");

  const hrefs = await page.locator("a[href]").evaluateAll(nodes =>
    nodes.map(node => String(node.href || ""))
  ).catch(() => []);

  const selfEvidence = hrefs.filter(href =>
    href.includes("reviews-" + PALLETTA_GROUP_ID) ||
    href.includes("/gim" + PALLETTA_GROUP_ID) ||
    href.includes("/cart" + PALLETTA_GROUP_ID) ||
    href.includes("market-" + PALLETTA_GROUP_ID)
  );

  if (!selfEvidence.length) {
    throw new Error("PALLETTA_GROUP_ID_NOT_CONFIRMED_IN_UI");
  }
}

async function clickOne(locator, label) {
  const count = await locator.count();
  if (count !== 1) {
    throw new Error(label + "_CANDIDATE_COUNT_" + count);
  }
  await locator.click();
}

async function findComposer(page) {
  const candidates = [
    page.getByRole("button", { name: /создать запись/i }),
    page.getByRole("button", { name: /новая запись/i }),
    page.getByText(/что у вас нового/i, { exact: false }),
    page.locator('[contenteditable="true"]').filter({ hasText: /./ })
  ];

  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    if (count === 1 && await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  throw new Error("VK_POST_COMPOSER_NOT_FOUND");
}

async function findVideoFileInput(page) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count();
  const matches = [];
  for (let i = 0; i < count; i += 1) {
    const input = inputs.nth(i);
    const accept = String(await input.getAttribute("accept").catch(() => "") || "").toLowerCase();
    if (!accept || accept.includes("video") || accept.includes("mp4")) {
      matches.push(input);
    }
  }
  if (matches.length !== 1) {
    throw new Error("VK_VIDEO_FILE_INPUT_COUNT_" + matches.length);
  }
  return matches[0];
}

async function findPublishButton(page) {
  const candidates = [
    page.getByRole("button", { name: /^опубликовать$/i }),
    page.getByRole("button", { name: /^отправить$/i }),
    page.getByRole("button", { name: /^разместить$/i })
  ];

  const visible = [];
  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = locator.nth(i);
      if (await item.isVisible().catch(() => false) && await item.isEnabled().catch(() => false)) {
        visible.push(item);
      }
    }
  }
  if (visible.length !== 1) {
    throw new Error("VK_PUBLISH_BUTTON_COUNT_" + visible.length);
  }
  return visible[0];
}

let context;
try {
  if (!process.env.VK_VIDEO_PATH) throw new Error("VK_VIDEO_PATH_MISSING");
  if (path.extname(videoPath).toLowerCase() !== ".mp4") throw new Error("VK_VIDEO_PATH_MUST_BE_MP4");
  const info = await stat(videoPath);
  if (!info.isFile() || info.size <= 0) throw new Error("VK_VIDEO_FILE_INVALID");

  const hash = await sha256Path(videoPath);
  console.log("PALLETTA_VK_BROWSER_PREFLIGHT=PASS");
  console.log("VIDEO_SHA256=" + hash);
  console.log("VIDEO_BYTES=" + info.size);

  if (dryRun) {
    console.log("PALLETTA_VK_BROWSER_PUBLISH=PREPARED_NO_WRITE");
    process.exit(0);
  }

  assertPalletaApproval(approval);

  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel,
    viewport: { width: 1440, height: 1000 }
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  await verifyPalleta(page);

  const wallLinksBefore = await getPalletaWallLinks(page);

  const composer = await findComposer(page);
  await composer.click();
  await page.waitForTimeout(1000);

  const fileInput = await findVideoFileInput(page);
  await fileInput.setInputFiles(videoPath);

  const started = Date.now();
  let publishButton = null;
  while (Date.now() - started < 120000) {
    try {
      publishButton = await findPublishButton(page);
      break;
    } catch {}
    await page.waitForTimeout(1500);
  }
  if (!publishButton) throw new Error("VK_VIDEO_UPLOAD_OR_PUBLISH_BUTTON_TIMEOUT");

  await verifyPalleta(page);
  await publishButton.click();

  await page.waitForTimeout(5000);
  if (!isVkUrl(page.url())) throw new Error("BROWSER_LEFT_VK_AFTER_PUBLISH");

  const wallLinksAfter = await getPalletaWallLinks(page);
  const newWallLinks = wallLinksAfter.filter(href => !wallLinksBefore.includes(href));

  if (newWallLinks.length === 1) {
    console.log("PALLETTA_VK_BROWSER_PUBLISH=CONFIRMED_UI_NEW_WALL_LINK");
    console.log("POST_URL=" + newWallLinks[0]);
  } else {
    console.log("PALLETTA_VK_BROWSER_PUBLISH=SUBMITTED_UNKNOWN_EXTERNAL_STATE");
    console.log("NEW_WALL_LINKS_FOUND=" + newWallLinks.length);
  }

  console.log("OBSERVED_AT=" + isoNow());
  console.log("VIDEO_SHA256=" + hash);
} catch (error) {
  console.error("PALLETTA_VK_BROWSER_PUBLISH=BLOCKED");
  console.error("REASON=" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 2;
} finally {
  if (context) await context.close().catch(() => {});
}
