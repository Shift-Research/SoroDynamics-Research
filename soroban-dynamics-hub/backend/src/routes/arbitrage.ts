import { Router, Request, Response } from "express";
import { eventStore } from "../index";

export const arbitrageRouter = Router();

interface SimulateInput {
  /**
   * Address that would execute the swap.
   */
  trader: string;

  /**
   * Notional token amount for the simulated swap (raw base units).
   */
  amount: string;

  /**
   * The hypothetical new multiplier (basis points) that a
   * `trigger_supply_shift` would set. The analysis compares
   * slippage before vs. after this shift.
   */
  hypotheticalNewMultiplierBp: number;
}

interface SimulateResponse {
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
 * POST /api/simulate-arbitrage
 *
 * Given a simulated swap amount and a hypothetical supply-shift
 * multiplier, computes the price slippage delta and classifies
 * the extractable value (tMEV).
 *
 * Request body — SimulateInput
 * Response    — SimulateResponse
 */
arbitrageRouter.post(
  "/simulate-arbitrage",
  (req: Request<unknown, unknown, SimulateInput>, res: Response) => {
    const { trader, amount, hypotheticalNewMultiplierBp } = req.body;

    if (!amount || !hypotheticalNewMultiplierBp) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const amt = BigInt(amount);
    if (amt <= 0) {
      res.status(400).json({ error: "amount must be positive" });
      return;
    }

    // Clamp multiplier the same way the on-chain contract does
    const newMult = Math.min(Math.max(hypotheticalNewMultiplierBp, 0), 50_000);

    // Derive the current multiplier from the latest on-chain event,
    // or default to 10_000 (1.0x).
    const currentMult = getCurrentMultiplier();

    // Effective amounts before & after the hypothetical shift.
    const beforeEffective = (amt * BigInt(currentMult)) / 10000n;
    const afterEffective = (amt * BigInt(newMult)) / 10000n;

    // Slippage is modelled as the absolute percentage delta between
    // the raw amount and the effective amount.
    const slippageBeforeBps = calculateSlippageBps(amt, beforeEffective);
    const slippageAfterBps = calculateSlippageBps(amt, afterEffective);

    // The extractable value is the difference in effective amounts.
    const delta = afterEffective - beforeEffective;
    const deltaBps =
      beforeEffective > 0n
        ? Number((delta * 10000n) / beforeEffective)
        : 0;

    let classification = "NONE";
    if (delta > 0n) {
      classification = deltaBps > 500 ? "HIGH_POSITIVE_MEV" : "LOW_POSITIVE_MEV";
    } else if (delta < 0n) {
      classification =
        deltaBps < -500 ? "HIGH_NEGATIVE_MEV" : "LOW_NEGATIVE_MEV";
    }

    const response: SimulateResponse = {
      simulationId: `sim-${Date.now()}`,
      analysis: {
        beforeShift: {
          priceMultiplierBp: currentMult,
          effectiveAmount: beforeEffective.toString(),
          slippageBps: slippageBeforeBps,
        },
        afterShift: {
          priceMultiplierBp: newMult,
          effectiveAmount: afterEffective.toString(),
          slippageBps: slippageAfterBps,
        },
        extractableValue: {
          deltaEffective: delta.toString(),
          deltaBps,
          classification,
        },
      },
    };

    res.json(response);
  }
);

/** Derive the current multiplier from the latest supply_shift event. */
function getCurrentMultiplier(): number {
  for (let i = eventStore.length - 1; i >= 0; i--) {
    const evt = eventStore[i];
    if (evt.type === "supply_shift") {
      return Number(evt.data.newMultiplier) || 10000;
    }
  }
  return 10000;
}

/** Slippage in basis points = |raw - effective| / raw * 10_000 */
function calculateSlippageBps(raw: bigint, effective: bigint): number {
  if (raw === 0n) return 0;
  const diff = raw > effective ? raw - effective : effective - raw;
  return Number((diff * 10000n) / raw);
}
