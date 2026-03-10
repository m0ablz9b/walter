import { useMemo } from "react";
import type { AppState } from "../types";
import type { EngineResult, PriceResolver } from "../lib/engine";
import { computeTaxReport, computeTaxForYear } from "../lib/engine";
import {
  buildPriceHistoryFromTransactions,
  getLastKnownPrice,
  priceCacheKey,
} from "../lib/prices";

function buildPriceResolver(state: AppState): PriceResolver {
  const priceHistory = buildPriceHistoryFromTransactions(state.transactions);

  return (date, holdings, currentTx) => {
    const prices: Record<string, number> = {};
    const txDate = new Date(date);

    for (const asset of Object.keys(holdings)) {
      if (holdings[asset] <= 0) continue;

      const cacheKey = priceCacheKey(date, asset);

      // 1. Manual price override
      if (state.manualPrices[cacheKey] !== undefined) {
        prices[asset] = state.manualPrices[cacheKey];
        continue;
      }

      // 2. Cached price
      if (state.priceCache[cacheKey] !== undefined) {
        prices[asset] = state.priceCache[cacheKey];
        continue;
      }

      // 3. Current transaction gives us a price for its asset
      if (currentTx.type === "buy" || currentTx.type === "sell") {
        if (currentTx.asset === asset && currentTx.pricePerUnit) {
          prices[asset] = currentTx.pricePerUnit;
          continue;
        }
      } else if (currentTx.type === "swap") {
        if (
          currentTx.fromAsset === asset &&
          currentTx.fromQuantity &&
          currentTx.totalEur
        ) {
          prices[asset] = currentTx.totalEur / currentTx.fromQuantity;
          continue;
        }
        if (
          currentTx.toAsset === asset &&
          currentTx.toQuantity &&
          currentTx.totalEur
        ) {
          prices[asset] = currentTx.totalEur / currentTx.toQuantity;
          continue;
        }
      }

      // 4. Last known price from transaction history
      const lastKnown = getLastKnownPrice(priceHistory, asset, txDate);
      if (lastKnown !== null) {
        prices[asset] = lastKnown;
        continue;
      }

      // 5. No price available — use 0 (will generate a warning)
      prices[asset] = 0;
    }

    return prices;
  };
}

export function useEngine(state: AppState): EngineResult {
  return useMemo(() => {
    if (state.transactions.length === 0) {
      return { snapshots: [], saleResults: [], annualReports: [], warnings: [] };
    }
    const resolver = buildPriceResolver(state);
    return computeTaxReport(state.transactions, resolver);
  }, [state]);
}

export function useEngineForYear(
  state: AppState,
  year: number
): { report: ReturnType<typeof computeTaxForYear>["report"]; fullResult: EngineResult } {
  return useMemo(() => {
    if (state.transactions.length === 0) {
      return {
        report: null,
        fullResult: { snapshots: [], saleResults: [], annualReports: [], warnings: [] },
      };
    }
    const resolver = buildPriceResolver(state);
    return computeTaxForYear(state.transactions, year, resolver);
  }, [state, year]);
}
