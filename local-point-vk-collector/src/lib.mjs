import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export function isoNow() {
  return new Date().toISOString();
}

export function safeStamp(iso = isoNow()) {
  return iso.replace(/[:.]/g, "-");
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function writeText(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
}

export async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

export function normalizeLinks(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item?.href) continue;
    const key = item.href.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      href: key,
      text: (item.text || "").trim().replace(/\s+/g, " ").slice(0, 500)
    });
  }
  return result;
}
