import { chromium } from "playwright";
import process from "node:process";
import {
  defaultEvidenceRoot,
  defaultProfileDir
} from "./lib.mjs";

const channel = process.env.VK_BROWSER_CHANNEL || "chrome";
const report = {
  collector: "local-point-vk-collector",
  version: "0.1.0",
  node: process.version,
  platform: process.platform,
  browser_channel: channel,
  profile_dir: process.env.VK_PROFILE_DIR || defaultProfileDir(),
  evidence_dir: process.env.VK_EVIDENCE_DIR || defaultEvidenceRoot(),
  browser_launch: "UNTESTED"
};

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel
  });
  report.browser_launch = "PASS";
} catch (error) {
  report.browser_launch = "BLOCKED";
  report.browser_error =
    error instanceof Error ? error.message : String(error);
  process.exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
}

console.log(JSON.stringify(report, null, 2));
