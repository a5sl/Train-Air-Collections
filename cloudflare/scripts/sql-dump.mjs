// Shared helpers: dump a sql.js database into D1-compatible INSERT SQL.
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js");

export async function openDb(file) {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(file);
  return new SQL.Database(buf);
}

export function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

export function rowsToSql(table, columns, rows) {
  const colList = columns.join(", ");
  const lines = [];
  for (const r of rows) {
    const values = columns.map((c) => esc(r[c])).join(", ");
    lines.push(`INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${values});`);
  }
  return lines.join("\n");
}