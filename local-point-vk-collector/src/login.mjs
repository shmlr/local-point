import { chromium } from "playwright";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

const profileDir = path.resolve(
  process.env.VK_PROFILE_DIR || ".local/vk-profile"
);
const channel = process.env.VK_BROWSER_CHANNEL || "chrome";

console.log("Local Point VK Collector - manual login");
console.log("Profile:", profileDir);
console.log("Browser channel:", channel);
console.log("");
console.log("Пароль и 2FA вводятся только в окне VK. Скрипт их не читает.");

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel,
  viewport: { width: 1440, height: 1000 }
});

const page = context.pages()[0] || await context.newPage();
await page.goto("https://vk.com/", {
  waitUntil: "domcontentloaded",
  timeout: 45000
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

await rl.question(
  "\nВойдите в VK вручную в открытом браузере. После успешного входа вернитесь сюда и нажмите Enter. "
);

rl.close();
await context.close();

console.log("Локальная браузерная сессия сохранена.");
console.log("Теперь можно запускать: npm run collect");
