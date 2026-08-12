import type { Env } from "./env";
import type { AuthUser } from "./auth";

export type Variables = {
  user: AuthUser;
};

export type AppEnv = { Bindings: Env; Variables: Variables };