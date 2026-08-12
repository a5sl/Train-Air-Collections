import type { Env } from "./env";

export const LOGO_PREFIX = "logos/";
export const UPLOAD_PREFIX = "uploads/";

export async function getLogo(env: Env, code: string) {
  return env.R2.get(LOGO_PREFIX + code + ".png");
}

/** R2 key for a user-scoped upload. Emails contain @/. which are safe in keys. */
function uploadKey(owner: string, filename: string) {
  return UPLOAD_PREFIX + owner + "/" + filename;
}

export async function getUpload(env: Env, owner: string, filename: string) {
  return env.R2.get(uploadKey(owner, filename));
}

export async function putUpload(env: Env, owner: string, filename: string, body: ArrayBuffer | Uint8Array, contentType: string) {
  await env.R2.put(uploadKey(owner, filename), body, { httpMetadata: { contentType } });
}

export async function deleteUpload(env: Env, owner: string, filename: string) {
  await env.R2.delete(uploadKey(owner, filename));
}