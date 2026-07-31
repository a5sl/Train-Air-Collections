/**
 * fix-timezones.ts
 * Populates the timezone column for all airports and train stations in seed.db.
 *
 * Strategy:
 *  - Chinese airports (country = "中国") → Asia/Shanghai, except:
 *      city 香港 → Asia/Hong_Kong, 澳门 → Asia/Macau, 台北 → Asia/Taipei
 *  - All other airports with lat/lng → tzlookup(lat, lng)
 *  - Train stations missing timezone → manual mapping (small known set)
 *  - Fallback for entries without coordinates → country-based default
 *
 * Run: npx tsx scripts/fix-timezones.ts
 */

import initSqlJs from "sql.js";
import tzlookup from "tz-lookup";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_PATH = path.resolve(__dirname, "../server/data/seed.db");

// --- Manual timezone for the 24 train stations missing it ---
const stationTimezoneMap: Record<number, string> = {
  11284: "Asia/Shanghai",      // 北京朝阳站
  11285: "Asia/Shanghai",      // 北京丰台站
  11295: "Asia/Shanghai",      // 福田站 (深圳)
  11306: "Asia/Shanghai",      // 杭州西站
  11355: "Asia/Hong_Kong",     // 香港西九龙站
  11356: "Asia/Taipei",        // 台北站
  11424: "Asia/Tokyo",         // 东京站
  11425: "Asia/Tokyo",         // 新宿站
  11426: "Asia/Tokyo",         // 品川站
  11427: "Asia/Tokyo",         // 京都站
  11428: "Asia/Tokyo",         // 新大阪站
  11430: "Asia/Tokyo",         // 名古屋站
  11431: "Asia/Seoul",         // 首尔站
  11432: "Asia/Seoul",         // 釜山站
  11433: "Europe/Paris",       // 巴黎北站
  11434: "Europe/Paris",       // 巴黎里昂站
  11435: "Europe/London",      // 伦敦圣潘克拉斯站
  11436: "Europe/Berlin",      // 柏林中央车站
  11437: "Europe/Berlin",      // 法兰克福中央车站
  11438: "Europe/Rome",        // 罗马特米尼站
  11439: "Europe/Madrid",      // 马德里阿托查站
  11440: "Europe/Amsterdam",   // 阿姆斯特丹中央站
  11441: "America/New_York",   // 纽约宾夕法尼亚站
  11442: "America/New_York",   // 华盛顿联合车站
};

// Country-code fallback for airports without usable coordinates
const countryDefault: Record<string, string> = {
  CN: "Asia/Shanghai", US: "America/New_York", JP: "Asia/Tokyo",
  KR: "Asia/Seoul", SG: "Asia/Singapore", TH: "Asia/Bangkok",
  MY: "Asia/Kuala_Lumpur", VN: "Asia/Ho_Chi_Minh", ID: "Asia/Jakarta",
  AE: "Asia/Dubai", QA: "Asia/Qatar", GB: "Europe/London",
  FR: "Europe/Paris", DE: "Europe/Berlin", NL: "Europe/Amsterdam",
  ES: "Europe/Madrid", IT: "Europe/Rome", CH: "Europe/Zurich",
  TR: "Europe/Istanbul", CA: "America/Toronto", AU: "Australia/Sydney",
  NZ: "Pacific/Auckland", IN: "Asia/Kolkata", RU: "Europe/Moscow",
  BR: "America/Sao_Paulo", MX: "America/Mexico_City",
  PH: "Asia/Manila", TW: "Asia/Taipei", HK: "Asia/Hong_Kong",
  MO: "Asia/Macau",
};

// Chinese-name country fallback (curated airports use Chinese country names)
const chineseCountryDefault: Record<string, string> = {
  "中国": "Asia/Shanghai", "日本": "Asia/Tokyo", "韩国": "Asia/Seoul",
  "新加坡": "Asia/Singapore", "泰国": "Asia/Bangkok", "马来西亚": "Asia/Kuala_Lumpur",
  "越南": "Asia/Ho_Chi_Minh", "印度尼西亚": "Asia/Jakarta", "阿联酋": "Asia/Dubai",
  "卡塔尔": "Asia/Qatar", "英国": "Europe/London", "法国": "Europe/Paris",
  "德国": "Europe/Berlin", "荷兰": "Europe/Amsterdam", "西班牙": "Europe/Madrid",
  "意大利": "Europe/Rome", "瑞士": "Europe/Zurich", "土耳其": "Europe/Istanbul",
  "美国": "America/New_York", "加拿大": "America/Toronto",
  "澳大利亚": "Australia/Sydney", "新西兰": "Pacific/Auckland", "印度": "Asia/Kolkata",
};

/** Resolve timezone for a Chinese airport based on city. */
function chinaCityTimezone(city: string): string {
  if (city.includes("香港")) return "Asia/Hong_Kong";
  if (city.includes("澳门")) return "Asia/Macau";
  if (city.includes("台北")) return "Asia/Taipei";
  return "Asia/Shanghai";
}

/** Resolve timezone for an airport row. */
function resolveAirportTz(country: string, city: string, lat: number | null, lng: number | null): string {
  // Chinese airports: single official timezone, with SAR exceptions
  if (country === "中国" || country === "CN") {
    return chinaCityTimezone(city);
  }
  // Use coordinate-based lookup when available
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    try {
      return tzlookup(lat, lng);
    } catch {
      // fall through to country default
    }
  }
  // Country-based fallback
  return chineseCountryDefault[country] || countryDefault[country] || "Etc/UTC";
}

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SEED_PATH);
  const db = new SQL.Database(buf);

  // ---- Fix airports ----
  const airports = db.exec("SELECT id, name, city, country, latitude, longitude, timezone FROM airports");
  let apUpdated = 0;
  let apSkipped = 0;
  if (airports.length > 0) {
    const rows = airports[0].values;
    const stmt = db.prepare("UPDATE airports SET timezone = ? WHERE id = ?");
    for (const row of rows) {
      const [id, name, city, country, lat, lng, existingTz] = row as [number, string, string, string, number | null, number | null, string | null];
      if (existingTz && existingTz.trim() !== "") {
        apSkipped++;
        continue;
      }
      const tz = resolveAirportTz(country, city, lat, lng);
      stmt.run([tz, id]);
      apUpdated++;
    }
    stmt.free();
  }
  console.log(`Airports: ${apUpdated} updated, ${apSkipped} already had timezone`);

  // ---- Fix train stations ----
  let stUpdated = 0;
  let stSkipped = 0;
  // First: apply manual mapping for the known 24
  for (const [idStr, tz] of Object.entries(stationTimezoneMap)) {
    const result = db.exec(`SELECT timezone FROM stations WHERE id = ${idStr}`);
    if (result.length > 0 && result[0].values.length > 0) {
      const existing = result[0].values[0][0] as string | null;
      if (existing && existing.trim() !== "") {
        stSkipped++;
        continue;
      }
    }
    db.run(`UPDATE stations SET timezone = ? WHERE id = ?`, [tz, parseInt(idStr)]);
    stUpdated++;
  }
  // Then: fix any remaining stations with empty timezone using coordinates
  const remaining = db.exec("SELECT id, name, city, country, latitude, longitude FROM stations WHERE timezone IS NULL OR timezone = ''");
  if (remaining.length > 0) {
    const stmt = db.prepare("UPDATE stations SET timezone = ? WHERE id = ?");
    for (const row of remaining[0].values) {
      const [id, name, city, country, lat, lng] = row as [number, string, string, string, number | null, number | null];
      let tz: string;
      if (country === "中国" || country === "CN") {
        tz = "Asia/Shanghai";
      } else if (lat != null && lng != null) {
        try { tz = tzlookup(lat, lng); } catch { tz = "Etc/UTC"; }
      } else {
        tz = chineseCountryDefault[country] || countryDefault[country] || "Etc/UTC";
      }
      stmt.run([tz, id]);
      stUpdated++;
    }
    stmt.free();
  }
  console.log(`Stations: ${stUpdated} updated, ${stSkipped} already had timezone`);

  // ---- Save ----
  const data = db.export();
  fs.writeFileSync(SEED_PATH, Buffer.from(data));
  console.log(`seed.db saved to ${SEED_PATH}`);

  // ---- Verify ----
  const verifyDb = new SQL.Database(fs.readFileSync(SEED_PATH));
  const apNull = verifyDb.exec("SELECT COUNT(*) FROM airports WHERE timezone IS NULL OR timezone = ''");
  const stNull = verifyDb.exec("SELECT COUNT(*) FROM stations WHERE timezone IS NULL OR timezone = ''");
  console.log(`Verification — airports without timezone: ${apNull[0].values[0][0]}, stations without timezone: ${stNull[0].values[0][0]}`);

  // Sample check
  const samples = verifyDb.exec(`
    SELECT name, city, country, timezone FROM airports WHERE name IN ('东京成田国际机场','纽约肯尼迪国际机场','伦敦希思罗机场','香港国际机场','乌鲁木齐地窝堡国际机场')
    UNION ALL
    SELECT name, city, country, timezone FROM stations WHERE id IN (11424, 11435, 11441, 11355)
  `);
  if (samples.length > 0) {
    console.log("\nSample results:");
    for (const row of samples[0].values) {
      console.log(`  ${row[0]} (${row[1]}, ${row[2]}) → ${row[3]}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
