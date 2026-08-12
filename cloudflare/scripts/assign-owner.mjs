// Assign an owner email to existing trips (backfill after 0002_multi_user.sql).
// Usage: node scripts/assign-owner.mjs --email <you@example.com> [--local|--remote]
//   default target: --local
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./run-wrangler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv.includes("--remote") ? "--remote" : "--local";

const emailIdx = process.argv.indexOf("--email");
let email = emailIdx >= 0 ? process.argv[emailIdx + 1] : "";

// Fall back to OWNER_EMAIL env var / root .env (OWNER_EMAIL=... line).
if (!email) {
  email = process.env.OWNER_EMAIL || "";
  const envFile = path.resolve(root, "../.env");
  if (!email && fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, "utf8").match(/^OWNER_EMAIL\s*[=:]\s*(.+)$/m);
    if (m) email = m[1].trim();
  }
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Missing/invalid owner email. Pass --email <you@example.com>");
  process.exit(1);
}

const sql = `UPDATE trips SET owner = '${email.replace(/'/g, "''")}' WHERE owner IS NULL OR owner = '';`;
run(["d1", "execute", "train-air-db", target, "--command", sql], root);
console.log(`Trips assigned to owner: ${email} (${target})`);