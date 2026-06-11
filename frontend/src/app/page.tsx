"use client";

import { StatePanel } from "@/components/StatePanel";
import { SimulationTrigger } from "@/components/SimulationTrigger";
import { AnalyticsLedger } from "@/components/AnalyticsLedger";

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Section A — State Panel (spans 1 column) */}
      <div className="lg:col-span-1">
        <StatePanel />
      </div>

      {/* Section B — Simulation Trigger (spans 1 column) */}
      <div className="lg:col-span-1">
        <SimulationTrigger />
      </div>

      {/* Section C — Analytics Ledger (full width below) */}
      <div className="lg:col-span-3">
        <AnalyticsLedger />
      </div>
    </div>
  );
}
