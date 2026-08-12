import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgJson = require.resolve("wrangler/package.json");
const pkg = JSON.parse(require("node:fs").readFileSync(pkgJson, "utf8"));
const wranglerCli = path.join(path.dirname(pkgJson), pkg.bin.wrangler);

/** Run the locally-installed wrangler CLI via node (avoids .cmd spawn issues on Windows). */
export function run(args, cwd) {
  execFileSync(process.execPath, [wranglerCli, ...args], { stdio: "inherit", cwd });
}