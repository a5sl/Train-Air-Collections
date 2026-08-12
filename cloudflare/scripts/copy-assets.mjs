// Copy the built frontend (client/dist) into cloudflare/assets for the
// Worker static-assets binding. Run `npm run build -w client` first.
import { existsSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDist = path.resolve(root, "../client/dist");
const assetsDir = path.join(root, "assets");

if (!existsSync(clientDist)) {
  console.error("client/dist not found. Run `npm run build -w client` first.");
  process.exit(1);
}

rmSync(assetsDir, { recursive: true, force: true });
mkdirSync(assetsDir, { recursive: true });
cpSync(clientDist, assetsDir, { recursive: true });
console.log("Copied client/dist -> cloudflare/assets");