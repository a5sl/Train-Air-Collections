import type { Env } from "./env";

export const LOGO_PREFIX = "logos/";
export const UPLOAD_PREFIX = "uploads/";

export async function getLogo(env: Env, code: string) {
  return env.R2.get(LOGO_PREFIX + code + ".png");
}

export async function getUpload(env: Env, filename: string) {
  return env.R2.get(UPLOAD_PREFIX + filename);
}

export async function putUpload(env: Env, filename: string, body: ArrayBuffer | Uint8Array, contentType: string) {
  await env.R2.put(UPLOAD_PREFIX + filename, body, { httpMetadata: { contentType } });
}

export async function deleteUpload(env: Env, filename: string) {
  await env.R2.delete(UPLOAD_PREFIX + filename);
}