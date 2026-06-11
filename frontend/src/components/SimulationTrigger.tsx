"use client";

import { useState } from "react";

interface AnalysisResult {
  simulationId: string;
  analysis: {
    beforeShift: {
      priceMultiplierBp: number;
      effectiveAmount: string;
      slippageBps: number;
    };
    afterShift: {
      priceMultiplierBp: number;
      effectiveAmount: string;
      slippageBps: number;
    };
    extractableValue: {
      deltaEffective: string;
      deltaBps: number;
      classification: string;
    };
  };
}

/**
 * Section B — Simulation Trigger
 *
 * Form that lets a developer input a trader address, notional
 * amount, and a hypothetical new multiplier to simulate how
 * a `trigger_supply_shift` would affect pricing and what
 * extractable value (tMEV) would be created.
 */
export function SimulationTrigger() {
  const [trader, setTrader] = useState("");
  const [amount, setAmount] = useState("");
  const [newMult, setNewMult] = useState("5000");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setRunning(true);

    try {
      const res = await fetch("/api/simulate-arbitrage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trader: trader || "GABCDEF1234567890",
          amount: amount || "1000000",
          hypotheticalNewMultiplierBp: parseInt(newMult, 10) || 5000,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Simulation failed");
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const classificationColor = (cls: string) => {
    if (cls.includes("HIGH")) return "text-red-400";
    if (cls.includes("LOW")) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Simulation Trigger
      </h2>

      <form onSubmit={handleSimulate} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">Trader Address</label>
          <input
            className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="GABCDEF..."
            value={trader}
            onChange={(e) => setTrader(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500">
            Notional Amount (raw)
          </label>
          <input
            className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="1000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500">
            New Multiplier (bp)
          </label>
          <input
            className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="5000"
            value={newMult}
            onChange={(e) => setNewMult(e.target.value)}
          />
          <p className="mt-0.5 text-[10px] text-gray-600">
            10000 = 1.0x &middot; 5000 = 0.5x &middot; 20000 = 2.0x
          </p>
        </div>

        <button
          type="submit"
          disabled={running}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {running ? "Simulating..." : "Simulate Supply Shift"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded border border-red-800 bg-red-950/50 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 space-y-2 rounded border border-gray-800 bg-gray-950 p-3 text-xs">
          <p className="text-gray-500">Simulation {result.simulationId}</p>

          <div className="flex justify-between">
            <span className="text-gray-400">Before (mult)</span>
            <span>{result.analysis.beforeShift.priceMultiplierBp} bp</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">After (mult)</span>
            <span>{result.analysis.afterShift.priceMultiplierBp} bp</span>
          </div>

          <div className="flex justify-between border-t border-gray-800 pt-2">
            <span className="text-gray-400">Slippage Before</span>
            <span>{result.analysis.beforeShift.slippageBps} bp</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Slippage After</span>
            <span>{result.analysis.afterShift.slippageBps} bp</span>
          </div>

          <div className="border-t border-gray-800 pt-2">
            <div className="flex justify-between font-semibold">
              <span className="text-gray-300">Extractable Value</span>
              <span
                className={classificationColor(
                  result.analysis.extractableValue.classification
                )}
              >
                {result.analysis.extractableValue.deltaEffective} (
                {result.analysis.extractableValue.deltaBps} bp)
              </span>
            </div>
            <div className="mt-1 text-right text-[10px] uppercase tracking-wider">
              <span
                className={classificationColor(
                  result.analysis.extractableValue.classification
                )}
              >
                {result.analysis.extractableValue.classification}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
