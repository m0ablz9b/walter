import type { Transaction, PriceCache } from "../types";

const CRYPTOCOMPARE_BASE = "https://min-api.cryptocompare.com/data";

function priceCacheKey(date: string, symbol: string): string {
  const d = new Date(date);
  const dateStr = d.toISOString().split("T")[0];
  return `${dateStr}:${symbol.toUpperCase()}`;
}

function toUnixTimestamp(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / 1000);
}

/**
 * Fetch a historical daily price from CryptoCompare.
 * Endpoint: /pricehistorical?fsym=BTC&tsyms=EUR&ts=<unix>
 * Returns: { "BTC": { "EUR": 23723.45 } }
 */
export async function fetchPrice(
  symbol: string,
  date: string,
  priceCache: PriceCache,
  manualPrices: PriceCache,
  apiKey?: string
): Promise<{
  price: number | null;
  updatedCache: PriceCache;
}> {
  const upper = symbol.toUpperCase();
  const key = priceCacheKey(date, upper);

  // 1. Manual price takes priority
  if (manualPrices[key] !== undefined) {
    return { price: manualPrices[key], updatedCache: priceCache };
  }

  // 2. Check cache
  if (priceCache[key] !== undefined) {
    return { price: priceCache[key], updatedCache: priceCache };
  }

  // 3. Known stable prices — no need to fetch
  const EUR_PEGGED = ["EUR", "EURE", "XDAI", "DAI", "EURX"];
  const USD_PEGGED = ["USDC", "USDT", "ARMMV3WXDAI", "ARMMV3USDC", "USDX"];
  if (EUR_PEGGED.includes(upper)) {
    const updatedCache = { ...priceCache, [key]: 1 };
    return { price: 1, updatedCache };
  }
  if (USD_PEGGED.includes(upper)) {
    // Approximate USD stablecoins at ~0.92 EUR (close enough for tax purposes,
    // actual rate fetched for the sell date matters more)
    const updatedCache = { ...priceCache, [key]: 0.92 };
    return { price: 0.92, updatedCache };
  }
  if (upper.startsWith("REALTOKEN-") || upper.startsWith("ARMMV3RTW-")) {
    // RealToken assets — skip, no reliable API source
    return { price: null, updatedCache: priceCache };
  }

  // 4. Aliases — tokens pegged to another asset
  const ALIASES: Record<string, string> = { PSETH: "ETH" };
  const fetchSymbol = ALIASES[upper] ?? upper;

  // 5. Fetch from CryptoCompare
  try {
    const ts = toUnixTimestamp(date);
    const headers: HeadersInit = {};
    if (apiKey) {
      headers["authorization"] = `Apikey ${apiKey}`;
    }
    const res = await fetch(
      `${CRYPTOCOMPARE_BASE}/pricehistorical?fsym=${fetchSymbol}&tsyms=EUR&ts=${ts}`,
      { headers }
    );
    if (!res.ok) {
      return { price: null, updatedCache: priceCache };
    }
    const data = await res.json();
    const eurPrice = data?.[fetchSymbol]?.EUR;
    if (eurPrice !== undefined && eurPrice !== null && eurPrice > 0) {
      const updatedCache = { ...priceCache, [key]: eurPrice };
      return { price: eurPrice, updatedCache };
    }
  } catch {
    // Network error
  }

  return { price: null, updatedCache: priceCache };
}

/**
 * Build a price lookup from transaction data.
 * Each transaction provides a price data point for its asset(s).
 */
export function buildPriceHistoryFromTransactions(
  transactions: Transaction[]
): Map<string, { date: Date; price: number }[]> {
  const history = new Map<string, { date: Date; price: number }[]>();

  for (const tx of transactions) {
    if (tx.type === "buy" || tx.type === "sell") {
      if (tx.asset && tx.pricePerUnit !== undefined) {
        if (!history.has(tx.asset)) history.set(tx.asset, []);
        history.get(tx.asset)!.push({
          date: new Date(tx.date),
          price: tx.pricePerUnit,
        });
      }
    } else if (tx.type === "swap") {
      if (tx.fromAsset && tx.fromQuantity && tx.totalEur) {
        const price = tx.totalEur / tx.fromQuantity;
        if (!history.has(tx.fromAsset)) history.set(tx.fromAsset, []);
        history.get(tx.fromAsset)!.push({ date: new Date(tx.date), price });
      }
      if (tx.toAsset && tx.toQuantity && tx.totalEur) {
        const price = tx.totalEur / tx.toQuantity;
        if (!history.has(tx.toAsset)) history.set(tx.toAsset, []);
        history.get(tx.toAsset)!.push({ date: new Date(tx.date), price });
      }
    }
  }

  for (const entries of history.values()) {
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return history;
}

/**
 * Get the last known price for an asset at or before a given date,
 * from transaction-derived price history.
 */
export function getLastKnownPrice(
  history: Map<string, { date: Date; price: number }[]>,
  asset: string,
  date: Date
): number | null {
  const entries = history.get(asset);
  if (!entries || entries.length === 0) return null;

  let bestPrice: number | null = null;
  for (const entry of entries) {
    if (entry.date.getTime() <= date.getTime()) {
      bestPrice = entry.price;
    } else {
      break;
    }
  }
  return bestPrice;
}

export { priceCacheKey };
