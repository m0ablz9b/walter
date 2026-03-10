import type { AppState } from "../types";

const STORAGE_KEY = "walter_app_state";

const DEFAULT_STATE: AppState = {
  transactions: [],
  priceCache: {},
  manualPrices: {},
};

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state to localStorage:", e);
  }
}

export function exportStateAsJson(): string {
  return localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(DEFAULT_STATE);
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
