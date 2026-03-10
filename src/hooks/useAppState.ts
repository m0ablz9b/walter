import { useState, useEffect, useCallback } from "react";
import type { AppState, Transaction, PriceCache } from "../types";
import { loadState, saveState } from "../lib/storage";

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addTransactions = useCallback((txs: Transaction[]) => {
    setState((prev) => {
      const existingIds = new Set(prev.transactions.map((t) => t.id));
      const newTxs = txs.filter((t) => !existingIds.has(t.id));
      const allTxs = [...prev.transactions, ...newTxs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      return { ...prev, transactions: allTxs };
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const updateTransaction = useCallback((updated: Transaction) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === updated.id ? updated : t
      ),
    }));
  }, []);

  const updatePriceCache = useCallback((updates: PriceCache) => {
    setState((prev) => ({
      ...prev,
      priceCache: { ...prev.priceCache, ...updates },
    }));
  }, []);

  const setManualPrice = useCallback((key: string, price: number) => {
    setState((prev) => ({
      ...prev,
      manualPrices: { ...prev.manualPrices, [key]: price },
    }));
  }, []);

  const setCryptoCompareApiKey = useCallback((apiKey: string) => {
    setState((prev) => ({
      ...prev,
      cryptoCompareApiKey: apiKey || undefined,
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState((prev) => ({
      transactions: [],
      priceCache: {},
      manualPrices: {},
      cryptoCompareApiKey: prev.cryptoCompareApiKey,
    }));
  }, []);

  const importState = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as AppState;
      setState((prev) => ({
        transactions: parsed.transactions ?? [],
        priceCache: parsed.priceCache ?? {},
        manualPrices: parsed.manualPrices ?? {},
        cryptoCompareApiKey: parsed.cryptoCompareApiKey ?? prev.cryptoCompareApiKey,
      }));
    } catch (e) {
      console.error("Failed to import state:", e);
      throw e;
    }
  }, []);

  return {
    state,
    addTransactions,
    deleteTransaction,
    updateTransaction,
    updatePriceCache,
    setManualPrice,
    setCryptoCompareApiKey,
    clearAll,
    importState,
  };
}
