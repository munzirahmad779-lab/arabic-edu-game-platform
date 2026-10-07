import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface HealthCheckResult {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  version: string;
  checks: {
    app: "ok" | "degraded";
    database: "ok" | "degraded" | "down" | "unconfigured";
    authentication: "ok" | "unconfigured";
    rpc: "ok" | "degraded" | "unconfigured";
    storage: "ok" | "degraded" | "unconfigured";
    migrations: "ok" | "degraded";
  };
  details?: {
    uptimeSeconds: number;
    latencyMs?: {
      database?: number;
      rpc?: number;
      storage?: number;
    };
    environment: string;
  };
}

async function probeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackError: string
): Promise<{ result?: T; error?: string; latencyMs: number }> {
  const start = Date.now();
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<{ result?: T; error?: string; latencyMs: number }>(
    (resolve) => {
      timer = setTimeout(() => {
        resolve({ error: fallbackError, latencyMs: timeoutMs });
      }, timeoutMs);
    }
  );

  const execPromise = promise
    .then((result) => ({
      result,
      latencyMs: Date.now() - start,
    }))
    .catch((err: Error) => ({
      error: err.message || "PROBE_FAILED",
      latencyMs: Date.now() - start,
    }));

  const outcome = await Promise.race([execPromise, timeoutPromise]);
  if (timer) clearTimeout(timer);
  return outcome;
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDeepRequested = request.nextUrl.searchParams.get("deep") === "true";

  const checks: HealthCheckResult["checks"] = {
    app: "ok",
    database: "unconfigured",
    authentication: "unconfigured",
    rpc: "unconfigured",
    storage: "unconfigured",
    migrations: "ok",
  };

  const latency: Record<string, number> = {};

  // 1. Authentication Configuration Check
  if (url && anonKey) {
    const isValidUrl = url.startsWith("https://") || url.startsWith("http://");
    const hasKey = anonKey.length > 10;
    checks.authentication = isValidUrl && hasKey ? "ok" : "unconfigured";
  }

  // 2. Database Connectivity Check (Read-only probe)
  if (checks.authentication === "ok" && url && anonKey) {
    try {
      const probe = await probeWithTimeout(
        fetch(`${url}/rest/v1/`, {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        }),
        3000,
        "DATABASE_TIMEOUT"
      );

      latency.database = probe.latencyMs;

      if (!probe.error && probe.result && probe.result.status < 500) {
        checks.database = "ok";
      } else {
        checks.database = "degraded";
      }
    } catch {
      checks.database = "degraded";
    }
  }

  // 3. RPC Sanity Check (Read-only probe: get_active_audio_tracks)
  if (checks.authentication === "ok" && url && anonKey) {
    try {
      const rpcProbe = await probeWithTimeout(
        fetch(`${url}/rest/v1/rpc/get_active_audio_tracks`, {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
        3000,
        "RPC_TIMEOUT"
      );

      latency.rpc = rpcProbe.latencyMs;

      if (!rpcProbe.error && rpcProbe.result && (rpcProbe.result.status === 200 || rpcProbe.result.status === 404)) {
        checks.rpc = "ok";
      } else {
        checks.rpc = "degraded";
      }
    } catch {
      checks.rpc = "degraded";
    }
  }

  // 4. Storage Connectivity Check (Read-only probe)
  if (checks.authentication === "ok" && url && anonKey) {
    try {
      const storageProbe = await probeWithTimeout(
        fetch(`${url}/storage/v1/bucket`, {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        }),
        3000,
        "STORAGE_TIMEOUT"
      );

      latency.storage = storageProbe.latencyMs;

      if (!storageProbe.error && storageProbe.result && storageProbe.result.status < 500) {
        checks.storage = "ok";
      } else {
        checks.storage = "degraded";
      }
    } catch {
      checks.storage = "degraded";
    }
  }

  // Overall Status Resolution
  let overallStatus: "ok" | "degraded" | "down" = "ok";

  if (checks.database === "down") {
    overallStatus = "down";
  } else if (
    checks.database === "degraded" ||
    checks.rpc === "degraded" ||
    checks.storage === "degraded" ||
    checks.authentication === "unconfigured"
  ) {
    // If running in development without credentials, it is degraded rather than completely down
    overallStatus = "degraded";
  }

  const responseBody: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    checks,
  };

  // Deep Diagnostic info only when requested & authorized
  if (isDeepRequested) {
    let isAuthorized = false;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) isAuthorized = true;
    } catch {
      isAuthorized = false;
    }

    if (isAuthorized) {
      responseBody.details = {
        uptimeSeconds: Math.floor(process.uptime()),
        latencyMs: latency,
        environment: process.env.NODE_ENV || "development",
      };
    }
  }

  const httpStatus = overallStatus === "down" ? 503 : 200;

  return NextResponse.json(responseBody, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
