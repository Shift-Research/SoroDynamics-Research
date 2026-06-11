import express from "express";
import cors from "cors";
import { StellarMonitor } from "./services/stellar-monitor";
import { arbitrageRouter } from "./routes/arbitrage";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// ── In-memory event store shared across routes ──────────────
export interface PoolEvent {
  id: string;
  type: "mint" | "supply_shift" | "initialize";
  txHash: string;
  ledger: number;
  timestamp: number;
  data: Record<string, unknown>;
}

export const eventStore: PoolEvent[] = [];

// ── Routes ──────────────────────────────────────────────────
app.use("/api", arbitrageRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    contractId: process.env.CONTRACT_ID || "(not set)",
    eventsIndexed: eventStore.length,
  });
});

// Expose indexed events for the frontend
app.get("/api/events", (_req, res) => {
  res.json(eventStore.slice(-200));
});

// ── Bootstrap Stellar monitor & start server ────────────────
async function main() {
  const rpcUrl =
    process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
  const contractId = process.env.CONTRACT_ID;

  if (contractId) {
    const monitor = new StellarMonitor(rpcUrl, contractId);
    // Start polling for events (every 6 s ≈ one Stellar ledger)
    monitor.startPolling(6_000, (event) => {
      eventStore.push(event);
      console.log("[event]", event.type, event.txHash);
    });
    console.log(`StellarMonitor: watching ${contractId}`);
  } else {
    console.warn(
      "STELLAR_RPC_URL / CONTRACT_ID not set — running without live events"
    );
  }

  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
