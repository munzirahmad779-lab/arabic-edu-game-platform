"use client";

import { useEffect, useState, useTransition } from "react";

interface HealthData {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  checks: {
    app: string;
    database: string;
    rpc: string;
    storage: string;
  };
}

export function DashboardHealthIndicator() {
  const [data, setData] = useState<HealthData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  function checkHealth() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok || res.status === 503) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        setData({
          status: "down",
          timestamp: new Date().toISOString(),
          checks: { app: "ok", database: "down", rpc: "down", storage: "down" },
        });
      }
    });
  }

  useEffect(() => {
    checkHealth();
  }, []);

  if (!data) return null;

  const isHealthy = data.status === "ok";
  const isDown = data.status === "down";

  return (
    <div className="border-t border-sage-200/60 p-3 text-xs">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 font-bold transition hover:opacity-80"
          aria-expanded={expanded}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isHealthy
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : isDown
                ? "bg-red-500 animate-pulse"
                : "bg-amber-500"
            }`}
          />
          <span className={isHealthy ? "text-emerald-800" : isDown ? "text-red-700" : "text-amber-800"}>
            {isHealthy ? "Sistem Aktif" : isDown ? "Sistem Gangguan" : "Sistem Terbatas"}
          </span>
        </button>

        <button
          type="button"
          onClick={checkHealth}
          disabled={isPending}
          className="rounded-lg border border-sage-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-softslate/80 hover:bg-sage-50 disabled:opacity-50"
          title="Periksa ulang status sistem"
        >
          {isPending ? "..." : "Periksa"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 space-y-1.5 rounded-xl border border-sage-200/80 bg-sage-50/50 p-2.5 text-[11px]">
          <div className="flex justify-between text-softslate">
            <span>Aplikasi:</span>
            <span className="font-bold text-emerald-700 uppercase">{data.checks.app}</span>
          </div>
          <div className="flex justify-between text-softslate">
            <span>Database:</span>
            <span
              className={`font-bold uppercase ${
                data.checks.database === "ok"
                  ? "text-emerald-700"
                  : data.checks.database === "unconfigured"
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {data.checks.database}
            </span>
          </div>
          <div className="flex justify-between text-softslate">
            <span>Layanan Game (RPC):</span>
            <span
              className={`font-bold uppercase ${
                data.checks.rpc === "ok"
                  ? "text-emerald-700"
                  : data.checks.rpc === "unconfigured"
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {data.checks.rpc}
            </span>
          </div>
          <div className="flex justify-between text-softslate">
            <span>Penyimpanan Media:</span>
            <span
              className={`font-bold uppercase ${
                data.checks.storage === "ok"
                  ? "text-emerald-700"
                  : data.checks.storage === "unconfigured"
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {data.checks.storage}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
