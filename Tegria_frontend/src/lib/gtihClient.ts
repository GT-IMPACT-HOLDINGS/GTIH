/**
 * Thin Tegria facade over the GTIH SDK.
 * Connectivity (host, port, paths, CA module) lives only in gtih-sdk.js.
 * Which GTIH host is chosen via DEPLOY_TARGET in src/deployTarget.ts.
 */

import { resolveGtihSdkUrl } from "../deployTarget";

export { resolveGtihSdkUrl };

export type OsngProposeResult = {
  status?: string;
  root_osn_id: string;
  nodes: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
};

export type ProposeStartResult = {
  status: string;
  run_id: string;
  session_id?: string;
  ca_session?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  detail?: string;
};

export type ProposeStatusResult = {
  status: string;
  run_id: string;
  envelope?: OsngProposeResult;
  root_osn_id?: string;
  nodes?: Array<Record<string, unknown>>;
  detail?: string;
  debug?: unknown;
  meta?: Record<string, unknown>;
};

type GtihClient = {
  getBaseUrl?: () => string;
  osng: {
    proposeFromIntentUntilDone: (
      args: { intent: string; max_descendants?: number },
      opts?: {
        onLog?: (line: string) => void;
        onStatus?: (st: ProposeStartResult | ProposeStatusResult) => void;
      }
    ) => Promise<OsngProposeResult>;
  };
};

declare global {
  interface Window {
    gtih?: GtihClient;
    createGtihClient?: (config?: { baseUrl?: string }) => GtihClient;
  }
}

export class OsngProposeError extends Error {
  status: number;
  detail?: string;
  debug?: unknown;
  body?: unknown;

  constructor(
    message: string,
    opts: { status: number; detail?: string; debug?: unknown; body?: unknown }
  ) {
    super(message);
    this.name = "OsngProposeError";
    this.status = opts.status;
    this.detail = opts.detail;
    this.debug = opts.debug;
    this.body = opts.body;
  }
}

export function formatProposeError(err: unknown): string {
  if (err instanceof OsngProposeError) {
    const parts = [
      `OSNG propose failed: ${err.detail || err.message}`,
      `HTTP ${err.status}`,
    ];
    if (err.debug != null) {
      parts.push("Debug:");
      parts.push(
        typeof err.debug === "string"
          ? err.debug
          : JSON.stringify(err.debug, null, 2)
      );
    }
    return parts.join("\n");
  }
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      status?: number;
      detail?: string;
      debug?: unknown;
      body?: unknown;
    };
    if (e.status != null || e.detail != null || e.debug != null) {
      return formatProposeError(
        new OsngProposeError(e.detail || e.message || "OSNG propose failed", {
          status: Number(e.status) || 502,
          detail: e.detail,
          debug: e.debug,
          body: e.body,
        })
      );
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

let loadPromise: Promise<GtihClient> | null = null;

export function loadGtihSdk(sdkUrl = resolveGtihSdkUrl()): Promise<GtihClient> {
  if (typeof window !== "undefined" && window.gtih?.osng?.proposeFromIntentUntilDone) {
    return Promise.resolve(window.gtih);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<GtihClient>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-gtih-sdk="1"]'
    );
    if (existing && window.gtih?.osng?.proposeFromIntentUntilDone) {
      resolve(window.gtih);
      return;
    }

    const script = document.createElement("script");
    script.src = sdkUrl;
    script.async = true;
    script.dataset.gtihSdk = "1";
    script.onload = () => {
      if (window.gtih?.osng?.proposeFromIntentUntilDone) {
        resolve(window.gtih);
      } else {
        reject(new Error("gtih-sdk.js loaded but window.gtih is missing"));
      }
    };
    script.onerror = () => {
      reject(new Error(`Failed to load GTIH SDK from ${sdkUrl}`));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function proposeFromIntentUntilDone(
  args: { intent: string; max_descendants?: number },
  opts?: {
    onLog?: (line: string) => void;
    onStatus?: (st: ProposeStartResult | ProposeStatusResult) => void;
  }
): Promise<OsngProposeResult> {
  const gtih = await loadGtihSdk();
  try {
    return await gtih.osng.proposeFromIntentUntilDone(args, opts);
  } catch (e) {
    if (e instanceof OsngProposeError) throw e;
    throw e;
  }
}
