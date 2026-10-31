import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export function isoNow() {
  return new Date().toISOString();
}

export function safeStamp(iso = isoNow()) {
  return iso.replace(/[:.]/g, "-");
}

export function defaultProfileDir() {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "LocalPoint", "vk-profile");
  }
  return path.resolve(".local/vk-profile");
}

export function defaultEvidenceRoot() {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "LocalPoint", "vk-evidence");
  }
  return path.resolve("evidence");
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

export function sanitizeUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    const url = new URL(input);
    url.username = "";
    url.password = "";
    url.hash = "";

    // VK often represents a direct wall post as ?w=wall-123_456.
    // Convert only that narrow, non-secret pattern to a canonical path.
    const wall = url.searchParams.get("w");
    if (
      url.hostname.toLowerCase().endsWith("vk.com") &&
      /^wall-?\d+_\d+$/.test(wall || "")
    ) {
      return `${url.origin}/${wall}`;
    }

    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return input.split(/[?#]/, 1)[0];
  }
}

export function normalizeLinks(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (!item?.href) continue;
    const safeHref = sanitizeUrl(item.href);
    if (!safeHref || seen.has(safeHref)) continue;

    seen.add(safeHref);
    result.push({
      href: safeHref,
      text: (item.text || "").trim().replace(/\s+/g, " ").slice(0, 500)
    });
  }

  return result;
}

export function summarizeBlockedRequests(items) {
  const counts = new Map();

  for (const item of items) {
    const safeUrl = sanitizeUrl(item.url);
    let endpoint = safeUrl;

    try {
      const parsed = new URL(safeUrl);
      endpoint = `${parsed.origin}${parsed.pathname}`;
    } catch {
      // Keep already-sanitized non-URL text.
    }

    const key = `${item.method || "UNKNOWN"} ${endpoint}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([request, count]) => ({ request, count }))
    .sort((a, b) => b.count - a.count || a.request.localeCompare(b.request));
}
