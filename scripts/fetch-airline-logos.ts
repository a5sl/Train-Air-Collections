/**
 * fetch-airline-logos.ts
 * Downloads airline logo PNGs for every IATA code in IATA_CODE_MAP and
 * saves them to server/data/airline-logos/{CODE}.png so the app can serve
 * logos locally instead of hot-linking a third-party CDN at runtime.
 *
 * Sources (tried in order per code):
 *   1. https://www.gstatic.com/flights/airline_logos/70px/{CODE}.png
 *      Google Flights icon marks - pure symbol without wordmark text (preferred).
 *   2. https://pics.avs.io/200/200/{CODE}.png         (wordmark fallback)
 *   3. https://images.kiwi.com/airlines/64/{CODE}.png  (wordmark fallback)
 * Codes that only resolve via fallback sources are listed in the summary;
 * delete those files if you prefer the monogram badge over a wordmark logo.
 *
 * A download is accepted only if it returns HTTP 200, an image/* content
 * type, and at least MIN_BYTES bytes (guards against HTML error pages and
 * empty placeholder responses).
 *
 * Run: npx tsx scripts/fetch-airline-logos.ts [--force] [--codes=CA,MU,NH]
 *   --force   re-download codes that already have a local file
 *   --codes   comma-separated whitelist of IATA codes to (re)download
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { IATA_CODE_MAP } from "../server/src/db/iata-codes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "server", "data", "airline-logos");

const SOURCES: Array<(code: string) => string> = [
  (code) => "https://www.gstatic.com/flights/airline_logos/70px/" + code + ".png",
  (code) => "https://content.r9cdn.net/rimg/provider-logos/airlines/v/" + code + ".png?crop=false&width=80&height=80",
  (code) => "https://pics.avs.io/200/200/" + code + ".png",
  (code) => "https://images.kiwi.com/airlines/64/" + code + ".png",
];

// Hint used to distinguish icon-source downloads from wordmark fallbacks.
const PREFERRED_SOURCE_HINT = "gstatic.com";
const ICON_SOURCE_HINT = "r9cdn.net";

// Known gstatic placeholder hashes — reject downloads that match these so the
// script falls through to avs.io / kiwi / Wikipedia sources.
const KNOWN_PLACEHOLDER_MD5S = new Set([
  "37fcfa2fc5492b6bb183b5c8dea32ce0",
  "ba08551665f9871cd35791d0297f036f",
]);

const MIN_BYTES = 400;
const CONCURRENCY = 5;
const DELAY_MS = 120;
const TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Wikipedia page titles for defunct/historical airlines without CDN logos.
const WIKIPEDIA_TITLES: Record<string, string> = {
  "3Q": "Yunnan_Airlines",
  "WH": "China_Northwest_Airlines",
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const codesArg = args.find((a) => a.startsWith("--codes="));
const whitelist = codesArg
  ? new Set(codesArg.split("=")[1].split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))
  : null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface DownloadResult {
  code: string;
  ok: boolean;
  source?: string;
  bytes?: number;
  reason?: string;
}

/** Returns true if a PNG buffer is RGB (no alpha channel). */
function isRgbPng(buf: Buffer): boolean {
  // PNG IHDR: byte 25 = color type (0=gray, 2=RGB, 3=indexed, 4=gray+alpha, 6=RGBA)
  if (buf.length < 26 || buf.toString("ascii", 1, 4) !== "PNG") return false;
  return buf[25] === 2; // 2 = RGB
}

/** Fetch a logo from Wikipedia's pageimages API as a last-resort fallback. */
async function downloadFromWikipedia(code: string): Promise<DownloadResult> {
  const title = WIKIPEDIA_TITLES[code];
  if (!title) return { code, ok: false, reason: "no wikipedia title" };

  const outFile = path.join(OUT_DIR, code + ".png");
  try {
    const apiUrl = "https://en.wikipedia.org/w/api.php?action=query&titles=" +
      encodeURIComponent(title) + "&prop=pageimages&format=json&pithumbsize=200&origin=*";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const jsonRes = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!jsonRes.ok) return { code, ok: false, reason: "wikipedia api failed" };

    const data = await jsonRes.json() as any;
    const pages = data?.query?.pages || {};
    const page: any = Object.values(pages)[0];
    const thumbUrl: string | undefined = page?.thumbnail?.source;
    if (!thumbUrl) return { code, ok: false, reason: "no wikipedia thumbnail" };

    const imgRes = await fetch(thumbUrl);
    if (!imgRes.ok) return { code, ok: false, reason: "wikipedia image download failed" };

    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < MIN_BYTES) return { code, ok: false, reason: "wikipedia image too small" };

    fs.writeFileSync(outFile, buf);
    return { code, ok: true, source: thumbUrl, bytes: buf.length };
  } catch {
    return { code, ok: false, reason: "wikipedia exception" };
  }
}

async function downloadOne(code: string): Promise<DownloadResult> {
  const outFile = path.join(OUT_DIR, code + ".png");
  if (!force && fs.existsSync(outFile)) {
    return { code, ok: true, source: "cache", bytes: fs.statSync(outFile).size };
  }

  for (const makeUrl of SOURCES) {
    const url = makeUrl(code);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
      });
      clearTimeout(timer);

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.startsWith("image/")) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) continue;

      // Reject the known gstatic placeholder so we fall through to next source.
      if (KNOWN_PLACEHOLDER_MD5S.has(createHash("md5").update(buf).digest("hex"))) continue;

      // gstatic sometimes returns RGB (white bg) instead of RGBA — skip so
      // Kayak / avs.io can provide a transparent version.
      if (url.includes("gstatic.com") && isRgbPng(buf)) continue;

      fs.writeFileSync(outFile, buf);
      return { code, ok: true, source: url, bytes: buf.length };
    } catch {
      // try next source
    }
  }

  // Try Wikipedia as a final fallback for defunct airlines.
  if (WIKIPEDIA_TITLES[code]) {
    const wikiResult = await downloadFromWikipedia(code);
    if (wikiResult.ok) return wikiResult;
  }
  return { code, ok: false, reason: "all sources failed" };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let codes = Object.keys(IATA_CODE_MAP);
  if (whitelist) codes = codes.filter((c) => whitelist.has(c));
  console.log("Fetching logos for " + codes.length + " airlines -> " + OUT_DIR);

  const results: DownloadResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < codes.length) {
      const code = codes[cursor++];
      const result = await downloadOne(code);
      results.push(result);
      const tag = result.ok ? (result.source === "cache" ? "SKIP" : " OK ") : "FAIL";
      const size = result.bytes ? " (" + result.bytes + "B)" : "";
      const why = result.reason ? " - " + result.reason : "";
      console.log("[" + tag + "] " + code + size + why);
      await sleep(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = results.filter((r) => r.ok && r.source !== "cache");
  const skipped = results.filter((r) => r.ok && r.source === "cache");
  const failed = results.filter((r) => !r.ok);

  // Report duplicate files (possible generic placeholders). Some airlines
  // legitimately share a logo (e.g. AirAsia family), so this is informational.
  const byHash = new Map<string, string[]>();
  for (const file of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"))) {
    const hash = createHash("sha256").update(fs.readFileSync(path.join(OUT_DIR, file))).digest("hex").slice(0, 12);
    byHash.set(hash, [...(byHash.get(hash) || []), file.replace(".png", "")]);
  }
  const dupes = [...byHash.values()].filter((group) => group.length >= 3);

  console.log("");
  console.log("===== Summary =====");
  const fromIcon = ok.filter((r) => (r.source || "").includes(PREFERRED_SOURCE_HINT));
  const fallback = ok.filter((r) => !(r.source || "").includes(PREFERRED_SOURCE_HINT));
  console.log("Downloaded: " + ok.length + " (icon-only: " + fromIcon.length + ", wordmark fallback: " + fallback.length + "), skipped (cached): " + skipped.length + ", failed: " + failed.length);
  if (fallback.length) console.log("Wordmark-fallback codes (delete these files to use monogram instead): " + fallback.map((r) => r.code).join(", "));
  if (failed.length) console.log("Failed codes: " + failed.map((r) => r.code).join(", "));
  if (dupes.length) console.log("Duplicate-image groups (check for placeholders): " + dupes.map((g) => g.join("/")).join(" | "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
