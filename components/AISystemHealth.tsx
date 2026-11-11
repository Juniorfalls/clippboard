"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProviderStatus = {
  provider: string;
  model: string;
  status: "healthy" | "error";
  message: string;
  latencyMs?: number;
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function AISystemHealth() {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/health", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | ProviderStatus[]
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          (data && !Array.isArray(data) && data.error) ||
            `Health check failed (${response.status}).`
        );
      }

      if (!Array.isArray(data)) {
        throw new Error("The health check returned an invalid response.");
      }

      setStatuses(data);
      setLastChecked(new Date());
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Could not check AI provider health.";
      setError(message);
      toast.error("Could not check AI health", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <section aria-label="AI system health" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-bold leading-[1.25]">
            AI System Health
          </h2>
          <p className="mt-1 text-[14px] text-soft-black/60">
            Live checks for provider keys and the models used by the pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-[12px] text-soft-black/50">
              Checked{" "}
              {lastChecked.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadHealth()}
            disabled={isLoading}
            aria-busy={isLoading}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2 border border-border-gray bg-white px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white disabled:cursor-not-allowed disabled:opacity-60",
              focusRing
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading && statuses.length === 0
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                aria-hidden
                className="animate-pulse rounded-3 border border-border-gray bg-white p-5"
              >
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="mt-3 h-3 w-32 rounded bg-gray-100" />
                <div className="mt-8 h-6 w-20 rounded-full bg-gray-100" />
                <div className="mt-4 h-3 w-full rounded bg-gray-100" />
              </div>
            ))
          : statuses.map((provider) => {
              const isHealthy = provider.status === "healthy";

              return (
                <article
                  key={provider.provider}
                  className="rounded-3 border border-border-gray bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-semibold text-soft-black">
                        {provider.provider}
                      </h3>
                      <p className="mt-1 truncate text-[12px] text-soft-black/50">
                        {provider.model}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold",
                        isHealthy
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {isHealthy ? "Healthy" : "Error"}
                    </span>
                  </div>

                  <p className="mt-4 text-[13px] leading-[1.5] text-soft-black/60">
                    {provider.message}
                  </p>

                  {typeof provider.latencyMs === "number" && (
                    <p className="mt-3 text-[12px] text-soft-black/40">
                      {provider.latencyMs}ms
                    </p>
                  )}
                </article>
              );
            })}
      </div>
    </section>
  );
}
