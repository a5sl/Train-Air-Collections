// Upload airline logos and existing trip uploads to R2.
// Usage: node scripts/upload-r2.mjs   (remote only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./run-wrangler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.resolve(root, "../server/data");
const bucket = "train-air";

function putR2(args) {
  run(["r2", "object", "put", "--remote", ...args], root);
}

// Airline logos -> logos/<CODE>.png
const logoDir = path.join(dataDir, "airline-logos");
if (fs.existsSync(logoDir)) {
  const files = fs.readdirSync(logoDir).filter((f) => f.toLowerCase().endsWith(".png"));
  console.log(`Uploading ${files.length} airline logos...`);
  for (const f of files) {
    putR2([`${bucket}/logos/${f}`, "--file", path.join(logoDir, f)]);
  }
}

// Existing trip uploads -> uploads/<filename>
const uploadsDir = path.join(dataDir, "uploads");
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  console.log(`Uploading ${files.length} existing uploads...`);
  for (const f of files) {
    putR2([`${bucket}/uploads/${f}`, "--file", path.join(uploadsDir, f)]);
  }
}

console.log("R2 upload complete.");