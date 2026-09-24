/**
 * Deploy target switch — flip to `'prod'` for Render Tegria ↔ GTIH.
 * Default `'dev'` keeps localhost development.
 *
 * Keep this file the single place for hard-wired remote origins until
 * production uses real env configuration.
 */
export type DeployTarget = "dev" | "prod";

/** Flip this to `"prod"` for production testing on Render. */
export const DEPLOY_TARGET: DeployTarget = "dev";

export const HARDWIRED_ORIGINS = {
  gtihDev: "http://localhost:8080",
  gtihProd: "https://gtih-image-latest.onrender.com",
  tegriaDev: "http://localhost:5173",
  tegriaProd: "https://tgfe-image-latest.onrender.com",
} as const;

export function isProdDeploy(): boolean {
  return DEPLOY_TARGET === "prod";
}

export function resolveGtihOrigin(): string {
  return isProdDeploy()
    ? HARDWIRED_ORIGINS.gtihProd
    : HARDWIRED_ORIGINS.gtihDev;
}

/** Sole pre-execution GTIH fact for Tegria: absolute SDK URL. */
export function resolveGtihSdkUrl(): string {
  return `${resolveGtihOrigin()}/gt2/gtih/gtih-sdk.js`;
}
