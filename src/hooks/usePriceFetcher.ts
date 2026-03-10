import { useState, useCallback, useRef } from "react";
import type { AppState, PriceCache } from "../types";
import { fetchPrice, priceCacheKey } from "../lib/prices";

export interface PriceFetcherStatus {
  isFetching: boolean;
  progress: { done: number; total: number };
  errors: string[];
  lastRun: Date | null;
}

// Assets that don't need external price fetching
const EUR_PEGGED = new Set(["EUR", "EURE", "XDAI", "DAI", "EURX"]);
const USD_PEGGED = new Set(["USDC", "USDT", "ARMMV3WXDAI", "ARMMV3USDC", "USDX"]);
const SKIP_TICKERS = new Set(["BEST"]);

function isSkippedAsset(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  if (EUR_PEGGED.has(upper) || USD_PEGGED.has(upper) || SKIP_TICKERS.has(upper)) return true;
  if (upper.startsWith("REALTOKEN-") || upper.startsWith("ARMMV3RTW-")) return true;
  return false;
}

/**
 * Collect all (date, asset) pairs that need prices.
 * Tracks holdings chronologically and records every missing (date, asset).
 */
function collectMissingPriceKeys(state: AppState): { date: string; asset: string }[] {
  const needed = new Map<string, { date: string; asset: string }>();

  const sorted = [...state.transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const holdings: Record<string, number> = {};

  for (const tx of sorted) {
    if (tx.type === "buy") {
      const asset = tx.asset!;
      holdings[asset] = (holdings[asset] ?? 0) + (tx.quantity ?? 0);
    } else if (tx.type === "sell") {
      const asset = tx.asset!;
      holdings[asset] = (holdings[asset] ?? 0) - (tx.quantity ?? 0);
      if (holdings[asset] <= 1e-10) delete holdings[asset];
    } else if (tx.type === "revenue") {
      const asset = tx.asset!;
      holdings[asset] = (holdings[asset] ?? 0) + (tx.quantity ?? 0);
    } else if (tx.type === "swap") {
      if (tx.fromAsset && tx.fromQuantity) {
        holdings[tx.fromAsset] = (holdings[tx.fromAsset] ?? 0) - tx.fromQuantity;
        if (holdings[tx.fromAsset] <= 1e-10) delete holdings[tx.fromAsset];
      }
      if (tx.toAsset && tx.toQuantity) {
        holdings[tx.toAsset] = (holdings[tx.toAsset] ?? 0) + tx.toQuantity;
      }
    }

    for (const asset of Object.keys(holdings)) {
      if (holdings[asset] <= 0) continue;
      if (isSkippedAsset(asset)) continue;
      const key = priceCacheKey(tx.date, asset);
      if (state.priceCache[key] !== undefined) continue;
      if (state.manualPrices[key] !== undefined) continue;
      if (!needed.has(key)) {
        needed.set(key, { date: tx.date, asset });
      }
    }
  }

  return [...needed.values()];
}

// CryptoCompare free: ~80 req/min, with API key: much higher
const RATE_LIMIT_FREE_MS = 2000;
const RATE_LIMIT_KEY_MS = 500;

export function usePriceFetcher(
  state: AppState,
  updatePriceCache: (updates: PriceCache) => void
) {
  const [status, setStatus] = useState<PriceFetcherStatus>({
    isFetching: false,
    progress: { done: 0, total: 0 },
    errors: [],
    lastRun: null,
  });
  const abortRef = useRef(false);

  const fetchMissingPrices = useCallback(async () => {
    abortRef.current = false;
    const missing = collectMissingPriceKeys(state);

    if (missing.length === 0) {
      setStatus((s) => ({
        ...s,
        isFetching: false,
        progress: { done: 0, total: 0 },
        errors: [],
        lastRun: new Date(),
      }));
      return;
    }

    setStatus({
      isFetching: true,
      progress: { done: 0, total: missing.length },
      errors: [],
      lastRun: null,
    });

    let currentCache = { ...state.priceCache };
    const errors: string[] = [];
    let done = 0;

    const FLUSH_INTERVAL = 10;

    for (const { date, asset } of missing) {
      if (abortRef.current) break;

      try {
        const result = await fetchPrice(
          asset,
          date,
          currentCache,
          state.manualPrices,
          state.cryptoCompareApiKey
        );
        currentCache = result.updatedCache;

        if (result.price === null) {
          errors.push(`${asset} on ${new Date(date).toISOString().split("T")[0]}`);
        }
      } catch {
        errors.push(`${asset} on ${new Date(date).toISOString().split("T")[0]} (network error)`);
      }

      done++;
      setStatus((s) => ({
        ...s,
        progress: { done, total: missing.length },
        errors: [...errors],
      }));

      if (done % FLUSH_INTERVAL === 0) {
        updatePriceCache(currentCache);
      }

      if (done < missing.length && !abortRef.current) {
        const delay = state.cryptoCompareApiKey ? RATE_LIMIT_KEY_MS : RATE_LIMIT_FREE_MS;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    updatePriceCache(currentCache);

    setStatus({
      isFetching: false,
      progress: { done, total: missing.length },
      errors,
      lastRun: new Date(),
    });
  }, [state, updatePriceCache]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const missingCount = collectMissingPriceKeys(state).length;

  return { status, fetchMissingPrices, abort, missingCount };
}
