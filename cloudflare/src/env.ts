export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  /** Cloudflare Access team name, e.g. "my-team". */
  TEAM_NAME: string;
  /** Access application Audience (AUD) tag. */
  POLICY_AUD: string;
  /** Local-dev only: skip Access and treat this email as the user. */
  DEV_USER?: string;
}