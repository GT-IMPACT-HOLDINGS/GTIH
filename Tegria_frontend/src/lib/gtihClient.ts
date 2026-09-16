/** Thin GTIH client for Tegria Vite app (async Hanuman propose). */

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
  if (err instanceof Error) return err.message;
  return String(err);
}

function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  try {
    const key = localStorage.getItem("lexiom_gt3_api_key");
    if (key) headers["X-GT3-OpenRouter-Key"] = key;
  } catch {
    /* ignore */
  }
  return headers;
}

export async function proposeFromIntent(args: {
  intent: string;
  max_descendants?: number;
}): Promise<ProposeStartResult> {
  const intent = String(args.intent || "").trim();
  if (!intent) throw new Error("intent must be non-empty");

  const headers = {
    ...openRouterHeaders(),
    "Content-Type": "application/json",
  };

  const res = await fetch("/lexiom13/osn/propose", {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      intent,
      max_descendants:
        args.max_descendants !== undefined ? Number(args.max_descendants) : 0,
    }),
  });
  const data = (await res.json().catch(() => null)) as ProposeStartResult & {
    detail?: string;
    debug?: unknown;
  };
  if (!res.ok) {
    throw new OsngProposeError(
      (data && data.detail) || `HTTP ${res.status}`,
      {
        status: res.status,
        detail: data?.detail,
        debug: data?.debug,
        body: data,
      }
    );
  }
  return data;
}

export async function getProposeStatus(
  runId: string
): Promise<ProposeStatusResult> {
  const id = String(runId || "").trim();
  if (!id) throw new Error("run_id required");
  const res = await fetch(
    `/lexiom13/osn/propose/status/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: openRouterHeaders(),
      cache: "no-store",
    }
  );
  const data = (await res.json().catch(() => null)) as ProposeStatusResult & {
    detail?: string;
    debug?: unknown;
  };
  if (!res.ok) {
    throw new OsngProposeError(
      (data && data.detail) || `HTTP ${res.status}`,
      {
        status: res.status,
        detail: data?.detail,
        debug: data?.debug,
        body: data,
      }
    );
  }
  return data;
}

async function serveProposeSession(
  caSession: Record<string, unknown>,
  opts?: { onLog?: (line: string) => void }
): Promise<unknown> {
  // Variable URL so Vite does not try to resolve the Lexiom CA module at build time.
  const caModuleUrl = `${window.location.origin}/gt2/Lexiom_1_3/ca/serveRamUnderGt3.js`;
  const mod = await import(/* @vite-ignore */ caModuleUrl);
  const run =
    mod.runBoltWebContainerCa || mod.iServeRamInTheWebContainer;
  if (typeof run !== "function") {
    throw new Error("serveRamUnderGt3 module missing runBoltWebContainerCa");
  }
  return run(caSession, { onLog: opts?.onLog });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Start → browser Hanuman → poll until envelope or failure.
 */
export async function proposeFromIntentUntilDone(
  args: { intent: string; max_descendants?: number },
  opts?: {
    onLog?: (line: string) => void;
    onStatus?: (st: ProposeStartResult | ProposeStatusResult) => void;
  }
): Promise<OsngProposeResult> {
  const started = await proposeFromIntent(args);
  opts?.onStatus?.(started);

  if (started.ca_session) {
    try {
      await serveProposeSession(started.ca_session, { onLog: opts?.onLog });
    } catch (laborErr) {
      const after = await getProposeStatus(started.run_id).catch(() => null);
      if (after?.status === "ok" && after.envelope) return after.envelope;
      throw new OsngProposeError(
        after?.detail ||
          (laborErr instanceof Error ? laborErr.message : String(laborErr)),
        {
          status: 502,
          detail: after?.detail,
          debug:
            after?.debug ||
            {
              phase: "hanuman_labor",
              error_message:
                laborErr instanceof Error ? laborErr.message : String(laborErr),
            },
          body: after,
        }
      );
    }
  }

  const maxWaitMs = 20 * 60 * 1000;
  const t0 = Date.now();
  while (Date.now() - t0 < maxWaitMs) {
    const st = await getProposeStatus(started.run_id);
    opts?.onStatus?.(st);
    if (st.status === "ok" && st.envelope) return st.envelope;
    if (st.status === "failed") {
      throw new OsngProposeError(st.detail || "OSNG propose failed", {
        status: 502,
        detail: st.detail,
        debug: st.debug,
        body: st,
      });
    }
    await sleep(1500);
  }
  throw new OsngProposeError("OSNG propose poll timeout", {
    status: 504,
    debug: { phase: "poll_timeout", run_id: started.run_id },
  });
}
