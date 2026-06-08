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
    const topic0 = raw.topic?.[0]?.toString() ?? "";
    const txHash = raw.txHash;
    const ledger = raw.ledger;

    let type: PoolEvent["type"] | null = null;
    let data: Record<string, unknown> = {};

    // Decode topic — the contract publishes ("pool", action)
    if (topic0.includes("supply_shift")) {
      type = "supply_shift";
      // topics[1]=old_mult, topics[2]=new_mult, body=total_minted
      data = {
        oldMultiplier: raw.topic[1]?.toString(),
        newMultiplier: raw.topic[2]?.toString(),
        totalMinted: raw.value?.toString(),
      };
    } else if (topic0.includes("mint")) {
      type = "mint";
      data = {
        to: raw.topic[1]?.toString(),
        amount: raw.topic[2]?.toString(),
        totalMinted: raw.topic[3]?.toString(),
      };
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
