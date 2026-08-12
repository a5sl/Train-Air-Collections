import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./env";
import type { AppEnv } from "./context";

// Access signs requests with a key unique to the team. The public keys live at
// https://<team-name>.cloudflareaccess.com/cdn-cgi/access/certs and rotate
// every 6 weeks, so we resolve them remotely through a JWKS instead of
// hardcoding a certificate.
function getJWKS(env: Env) {
  return createRemoteJWKSet(
    new URL(`https://${env.TEAM_NAME}.cloudflareaccess.com/cdn-cgi/access/certs`),
  );
}

export interface AuthUser {
  email: string;
}

/**
 * Middleware that resolves the authenticated user from the Cloudflare Access
 * JWT and stores it on the Hono context (`user`). Requests without a valid
 * token are rejected with 401.
 *
 * Local development (`wrangler dev`) has no Cloudflare Access in front, so it
 * falls back to the DEV_USER variable when one is set.
 */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await resolveUser(c.env, c.req.raw);
  if (!user) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  c.set("user", user);
  await next();
};

/** Extract a verified user from a request, or null when unauthenticated. */
export async function resolveUser(env: Env, request: Request): Promise<AuthUser | null> {
  if (env.DEV_USER) return { email: env.DEV_USER };

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWKS(env), {
      issuer: `https://${env.TEAM_NAME}.cloudflareaccess.com`,
      audience: env.POLICY_AUD,
    });
    const email = (
      typeof payload.email === "string" ? payload.email : payload.sub
    )?.trim().toLowerCase();
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}

/** Read the current user from the Hono context (set by requireUser). */
export function getUser(c: import("hono").Context<AppEnv>): AuthUser {
  return c.get("user");
}