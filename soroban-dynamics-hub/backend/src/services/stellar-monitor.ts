import {
  Server,
  SorobanRpc,
  Transaction,
  hash,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";
import { PoolEvent } from "../index";

/**
 * Polls the Soroban RPC endpoint for ledger entries and
 * transaction events that match our deployed contract.
 *
 * Environment variables consumed:
 *   STELLAR_RPC_URL  — Soroban RPC endpoint
 *   CONTRACT_ID       — deployed contract hex ID
 */
export class StellarMonitor {
  private server: Server;
  private contractId: string;
  private lastLedger = 0;

  constructor(rpcUrl: string, contractId: string) {
    this.server = new Server(rpcUrl);
    this.contractId = contractId;
  }

  /**
   * Begin polling.  Calls `onEvent` for every new PoolEvent discovered.
   */
  startPolling(intervalMs: number, onEvent: (evt: PoolEvent) => void): void {
    const poll = async () => {
      try {
        await this.pollOnce(onEvent);
      } catch (err) {
        console.error("[StellarMonitor] poll error", err);
      }
    };
    poll();
    setInterval(poll, intervalMs);
  }

  private async pollOnce(onEvent: (evt: PoolEvent) => void): Promise<void> {
    const latestLedger = await this.server.getLatestLedger();
    if (latestLedger.sequence <= this.lastLedger) return;

    const from = this.lastLedger || latestLedger.sequence - 1;
    const to = latestLedger.sequence;

    // Fetch events using the Soroban RPC events API
    const events = await this.server.events({
      startLedger: from,
      filters: [
        {
          type: "contract",
          contractIds: [this.contractId],
        },
      ],
      limit: 100,
    });

    for (const event of events) {
      try {
        const parsed = this.parseEvent(event);
        if (parsed) onEvent(parsed);
      } catch {
        // skip unparseable events
      }
    }

    this.lastLedger = to;
  }

  private parseEvent(raw: SorobanRpc.EventResponse): PoolEvent | null {
    if (!raw.topic || raw.topic.length < 2) return null;

    // topics[0] is the "pool" Symbol
    const topic0 = scValToNative(raw.topic[0]);
    if (topic0 !== "pool") return null;

    // topics[1] is the action (mint, supply_shift, initialize)
    const action = scValToNative(raw.topic[1]);
    const value = scValToNative(raw.value);
    const txHash = raw.txHash;
    const ledger = raw.ledger;

    let type: PoolEvent["type"] | null = null;
    let data: Record<string, unknown> = {};

    if (action === "supply_shift") {
      type = "supply_shift";
      data = {
        oldMultiplier: value[0]?.toString(),
        newMultiplier: value[1]?.toString(),
        totalMinted: value[2]?.toString(),
      };
    } else if (action === "mint") {
      type = "mint";
      data = {
        to: value[0]?.toString(),
        amount: value[1]?.toString(),
        totalMinted: value[2]?.toString(),
      };
    } else if (action === "initialize") {
      type = "initialize";
      data = { admin: value[0]?.toString() };
    }

    if (!type) return null;

    return {
      id: `${txHash}-${ledger}-${type}`,
      type,
      txHash,
      ledger,
      timestamp: Date.now(),
      data,
    };
  }
}
