"use client";

import { useEffect, useState } from "react";

interface StateData {
  status: string;
  contractId: string;
  eventsIndexed: number;
}

/**
 * Section A — State Panel
 *
 * Displays live status of the Stellar connection, the current
 * dynamic balance scaler (price multiplier), and the total
 * number of indexed contract interactions.
 */
export function StatePanel() {
  const [state, setState] = useState<StateData | null>(null);
  const [multiplier, setMultiplier] = useState<number>(10000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: StateData) => {
        setState(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Poll events to derive the latest multiplier
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/events");
        const events: Array<{ type: string; data: Record<string, unknown> }> =
          await res.json();
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].type === "supply_shift") {
            setMultiplier(Number(events[i].data.newMultiplier) || 10000);
            break;
          }
        }
        // Also update count from health
        const health = await fetch("/api/health").then((r) => r.json());
        setState(health);
      } catch {
        // offline — keep previous values
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, []);

  const scalerX = (multiplier / 10000).toFixed(4);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        State Panel
      </h2>

      {loading && !state ? (
        <p className="text-sm text-gray-500">Connecting...</p>
      ) : (
        <dl className="space-y-3 text-sm">
          {/* Connection status */}
          <div className="flex items-center justify-between">
            <dt className="text-gray-400">Network</dt>
            <dd className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  state?.status === "ok" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              {state?.status === "ok" ? "Connected" : "Disconnected"}
            </dd>
          </div>

          {/* Contract ID */}
          <div className="flex items-center justify-between">
            <dt className="text-gray-400">Contract</dt>
            <dd className="max-w-[180px] truncate font-mono text-xs text-gray-300">
              {state?.contractId || "—"}
            </dd>
          </div>

          {/* Price multiplier / scaler */}
          <div className="border-t border-gray-800 pt-3">
            <dt className="text-gray-400">Balance Scaler</dt>
            <dd className="mt-1 text-2xl font-bold text-blue-400">
              {scalerX}x
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({multiplier} bp)
              </span>
            </dd>
          </div>

          {/* Total events indexed */}
          <div className="flex items-center justify-between border-t border-gray-800 pt-3">
            <dt className="text-gray-400">Interactions Indexed</dt>
            <dd className="font-mono text-lg text-white">
              {state?.eventsIndexed ?? 0}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
