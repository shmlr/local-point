import { chromium } from "playwright";
import path from "node:path";
import process from "node:process";
import { stat } from "node:fs/promises";
import {
  defaultEvidenceRoot,
  defaultProfileDir,
  ensureDir,
  isoNow,
  safeStamp,
  writeJson
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
const diagnose = process.env.VK_PUBLISH_DIAGNOSE === "1";
let stage = "START";
let page = null;

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

async function collectUiDiagnostics(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const controls = await page.locator('button, [role="button"], a[href], textarea, input, [contenteditable="true"]').evaluateAll(nodes =>
    nodes.map((node, index) => ({
      index,
      tag: String(node.tagName || "").toLowerCase(),
      role: node.getAttribute?.("role") || null,
      type: node.getAttribute?.("type") || null,
      text: String(node.innerText || node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 180),
      aria: node.getAttribute?.("aria-label") || null,
      placeholder: node.getAttribute?.("placeholder") || null,
      href: node.getAttribute?.("href") || null,
      contenteditable: node.getAttribute?.("contenteditable") || null
    })).filter(x => x.text || x.aria || x.placeholder || x.contenteditable === "true").slice(0, 160)
  ).catch(() => []);

  const interesting = controls.filter(x => {
    const hay = [x.text, x.aria, x.placeholder, x.href].filter(Boolean).join(" ");
    return /(запис|пост|публик|созда|добав|нов|управ|войти|вход|write|post|publish|create|add|manage|login)/i.test(hay) ||
      x.contenteditable === "true" ||
      x.tag === "textarea";
  });

  return {
    title,
    final_url: page.url(),
    body_text_sample: bodyText.replace(/\s+/g, " ").slice(0, 1200),
    controls_count: controls.length,
    interesting_controls: interesting.slice(0, 80)
  };
}

async function findComposer(page) {
  const candidates = [
    page.getByRole("button", { name: /создать запись/i }),
    page.getByRole("button", { name: /новая запись/i }),
    page.getByRole("button", { name: /добавить запись/i }),
    page.getByText(/что у вас нового/i, { exact: false }),
    page.getByText(/создать запись/i, { exact: false }),
    page.getByText(/добавить запись/i, { exact: false }),
    page.locator('[contenteditable="true"]'),
    page.locator('textarea[placeholder*="нов" i]')
  ];

  const visible = [];
  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = locator.nth(i);
      if (await item.isVisible().catch(() => false)) visible.push(item);
    }
  }

  if (visible.length === 1) return visible[0];

  if (visible.length === 0) {
    const createButtons = page.getByRole("button", { name: /^создать$/i });
    const count = await createButtons.count().catch(() => 0);
    const visibleCreate = [];
    for (let i = 0; i < count; i += 1) {
      const item = createButtons.nth(i);
      if (await item.isVisible().catch(() => false)) visibleCreate.push(item);
    }
    if (visibleCreate.length === 1) {
      return { kind: "CREATE_MENU", locator: visibleCreate[0] };
    }
  }

  throw new Error("VK_POST_COMPOSER_NOT_FOUND");
}

async function openWallPostFromCreateMenu(page) {
  const postOptions = page.getByRole("button", { name: /^пост$/i });
  const count = await postOptions.count().catch(() => 0);
  const visible = [];
  for (let i = 0; i < count; i += 1) {
    const item = postOptions.nth(i);
    if (await item.isVisible().catch(() => false)) visible.push(item);
  }
  if (visible.length !== 1) {
    throw new Error("VK_CREATE_MENU_WALL_POST_COUNT_" + visible.length);
  }
  await visible[0].click();
  await page.waitForTimeout(1200);
}

async function findVideoFileInput(page) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count();

  const explicitVideo = [];
  const generic = [];

  for (let i = 0; i < count; i += 1) {
    const input = inputs.nth(i);
    const accept = String(await input.getAttribute("accept").catch(() => "") || "").toLowerCase();

    if (accept.includes("video") || accept.includes("mp4")) {
      explicitVideo.push(input);
    } else if (!accept) {
      generic.push(input);
    }
  }

  if (explicitVideo.length === 1) {
    return explicitVideo[0];
  }

  if (explicitVideo.length > 1) {
    throw new Error("VK_EXPLICIT_VIDEO_FILE_INPUT_COUNT_" + explicitVideo.length);
  }

  if (generic.length === 1) {
    return generic[0];
  }

  throw new Error("VK_VIDEO_FILE_INPUT_COUNT_" + (explicitVideo.length + generic.length));
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

  if (dryRun && !diagnose) {
    console.log("PALLETTA_VK_BROWSER_PUBLISH=PREPARED_NO_WRITE");
    process.exit(0);
  }

  if (!diagnose) {
    assertPalletaApproval(approval);
  }

  stage = "LAUNCH_BROWSER";
  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel,
    viewport: { width: 1440, height: 1000 }
  });

  page = context.pages()[0] || await context.newPage();
  stage = "OPEN_PALLETTA";
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  stage = "VERIFY_PALLETTA";
  await verifyPalleta(page);

  const wallLinksBefore = await getPalletaWallLinks(page);

  stage = "FIND_COMPOSER";
  const composer = await findComposer(page);

  stage = "OPEN_COMPOSER";
  const composerKind = composer?.kind || "DIRECT";
  const composerLocator = composer?.locator || composer;
  await composerLocator.click();
  await page.waitForTimeout(1000);

  if (composerKind === "CREATE_MENU") {
    stage = "SELECT_WALL_POST";
    await openWallPostFromCreateMenu(page);
  }

  if (diagnose) {
    const evidenceDir = path.join(defaultEvidenceRoot(), "publish-diagnose-" + safeStamp(isoNow()));
    await ensureDir(evidenceDir);

    const inputs = page.locator('input[type="file"]');
    const inputCount = await inputs.count().catch(() => 0);
    const inputAccept = [];
    for (let i = 0; i < inputCount; i += 1) {
      inputAccept.push({
        index: i,
        accept: await inputs.nth(i).getAttribute("accept").catch(() => null)
      });
    }

    const buttons = await page.locator("button").evaluateAll(nodes =>
      nodes.map((node, index) => ({
        index,
        text: String(node.innerText || node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
        disabled: Boolean(node.disabled)
      })).filter(x => x.text).slice(0, 80)
    ).catch(() => []);

    const screenshotPath = path.join(evidenceDir, "composer.png");
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    const diagnostic = {
      observed_at: isoNow(),
      stage: "COMPOSER_OPENED",
      final_url: page.url(),
      wall_links_before: wallLinksBefore,
      file_input_count: inputCount,
      file_inputs: inputAccept,
      buttons
    };
    await writeJson(path.join(evidenceDir, "diagnostic.json"), diagnostic);

    console.log("PALLETTA_VK_DIAGNOSE=PASS");
    console.log("DIAG_STAGE=WALL_POST_COMPOSER_OPENED");
    console.log("FILE_INPUT_COUNT=" + inputCount);
    console.log("FILE_INPUTS_JSON=" + JSON.stringify(inputAccept));
    const ui = await collectUiDiagnostics(page);
    console.log("BODY_SAMPLE=" + ui.body_text_sample);
    console.log("INTERESTING_CONTROLS_JSON=" + JSON.stringify(ui.interesting_controls));
    console.log("DIAG_PATH=" + evidenceDir);
    process.exit(0);
  }

  stage = "FIND_VIDEO_FILE_INPUT";
  const fileInput = await findVideoFileInput(page);
  stage = "UPLOAD_VIDEO";
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

  stage = "REVERIFY_PALLETTA_BEFORE_PUBLISH";
  await verifyPalleta(page);

  stage = "CLICK_PUBLISH";
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
  if (page) {
    try {
      const evidenceDir = path.join(defaultEvidenceRoot(), "publish-blocked-" + safeStamp(isoNow()));
      await ensureDir(evidenceDir);
      await page.screenshot({ path: path.join(evidenceDir, "blocked.png"), fullPage: true }).catch(() => {});
      const ui = await collectUiDiagnostics(page).catch(() => null);
      await writeJson(path.join(evidenceDir, "blocked.json"), {
        observed_at: isoNow(),
        stage,
        reason: error instanceof Error ? error.message : String(error),
        final_url: page.url(),
        ui
      });
      console.log("DIAG_PATH=" + evidenceDir);
      if (ui) {
        console.log("PAGE_TITLE=" + ui.title);
        console.log("PAGE_URL=" + ui.final_url);
        console.log("CONTROLS_COUNT=" + ui.controls_count);
        console.log("BODY_SAMPLE=" + ui.body_text_sample);
        console.log("INTERESTING_CONTROLS_JSON=" + JSON.stringify(ui.interesting_controls));
      }
    } catch {}
  }
  console.log("PALLETTA_VK_BROWSER_PUBLISH=BLOCKED");
  console.log("STAGE=" + stage);
  console.log("REASON=" + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 2;
} finally {
  if (context) await context.close().catch(() => {});
}
