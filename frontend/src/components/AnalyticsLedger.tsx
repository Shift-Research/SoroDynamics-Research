"use client";

import { useEffect, useState } from "react";

interface PoolEvent {
  id: string;
  type: "mint" | "supply_shift";
  txHash: string;
  ledger: number;
  timestamp: number;
  data: Record<string, unknown>;
}

const TYPE_CONFIG: Record<
  PoolEvent["type"],
  { label: string; color: string }
> = {
  mint: { label: "Normal Transfer", color: "bg-blue-600/20 text-blue-400" },
  supply_shift: {
    label: "Supply Mutation Event",
    color: "bg-red-600/20 text-red-400",
  },
};

/**
 * Section C — Analytics Ledger
 *
 * A scannable tracking table that displays indexed on-chain events
 * from the Soroban contract. Each row colour-codes the event type
 * and shows the data payload.
 */
export function AnalyticsLedger() {
  const [events, setEvents] = useState<PoolEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/events");
        const data: PoolEvent[] = await res.json();
        setEvents(data.reverse());
      } catch {
        // offline
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 4_000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("en-US", { hour12: false });

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Analytics Ledger
      </h2>

      {loading ? (
        <p className="text-sm text-gray-500">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">
          No events indexed yet. Deploy the contract and submit transactions to
          see activity.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Ledger</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Tx Hash</th>
                <th className="pb-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => {
                const cfg = TYPE_CONFIG[evt.type];
                return (
                  <tr
                    key={evt.id}
                    className="border-b border-gray-800/50 transition hover:bg-gray-800/30"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                      {formatTime(evt.timestamp)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                      {evt.ledger}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate py-2 pr-4 font-mono text-xs text-gray-400">
                      {evt.txHash}
                    </td>
                    <td className="max-w-[200px] truncate py-2 font-mono text-xs text-gray-500">
                      {JSON.stringify(evt.data)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
