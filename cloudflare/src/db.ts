import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import type { Env } from "./env";

function makeSeed(db: D1Database) {
  return drizzle(db, { schema: schema.seedSchema });
}
function makeUser(db: D1Database) {
  return drizzle(db, { schema: schema.userSchema });
}

export interface Dbs {
  seed: ReturnType<typeof makeSeed>;
  user: ReturnType<typeof makeUser>;
}

/** Build the two logical drizzle instances over the single D1 database. */
export function getDbs(env: Env): Dbs {
  return { seed: makeSeed(env.DB), user: makeUser(env.DB) };
}