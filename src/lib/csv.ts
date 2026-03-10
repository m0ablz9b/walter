import Papa from "papaparse";
import type { Transaction } from "../types";
import { generateId } from "./uuid";

export interface CsvColumn {
  header: string;
  sampleValues: string[];
}

export interface CsvParseResult {
  columns: CsvColumn[];
  rows: string[][];
  totalRows: number;
  detectedFormat: "french-exchange" | "generic";
}

export interface ColumnMapping {
  date?: number;
  type?: number;
  asset?: number;
  quantity?: number;
  pricePerUnit?: number;
  totalEur?: number;
  fees?: number;
  exchange?: number;
  notes?: number;
  // Swap-specific
  fromAsset?: number;
  fromQuantity?: number;
  toAsset?: number;
  toQuantity?: number;
}

// Headers for the French exchange format (Waltio / Coqonut style)
const FRENCH_EXCHANGE_HEADERS = [
  "Type",
  "Date",
  "Montant reçu",
  "Monnaie ou jeton reçu",
  "Montant envoyé",
  "Monnaie ou jeton envoyé",
  "Frais",
  "Monnaie ou jeton des frais",
];

const FIAT_CURRENCIES = new Set(["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY"]);

function isFiat(currency: string): boolean {
  return FIAT_CURRENCIES.has(currency.toUpperCase().trim());
}

function detectFrenchExchangeFormat(headers: string[]): boolean {
  const normalized = headers.map((h) => h.trim());
  return FRENCH_EXCHANGE_HEADERS.every((expected) =>
    normalized.some((h) => h.toLowerCase() === expected.toLowerCase())
  );
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (result) => {
        const data = result.data as string[][];
        if (data.length < 2) {
          reject(new Error("CSV file must have at least a header row and one data row"));
          return;
        }

        const headers = data[0];
        const rows = data.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));

        const columns: CsvColumn[] = headers.map((header, i) => ({
          header: header.trim(),
          sampleValues: rows.slice(0, 5).map((row) => row[i]?.trim() ?? ""),
        }));

        const detectedFormat = detectFrenchExchangeFormat(headers.map(h => h.trim()))
          ? "french-exchange"
          : "generic";

        resolve({
          columns,
          rows,
          totalRows: rows.length,
          detectedFormat,
        });
      },
      error: (error) => {
        reject(error);
      },
      skipEmptyLines: true,
    });
  });
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  // Handle European number format (comma as decimal separator)
  const cleaned = value.trim().replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseFrenchDate(value: string | undefined, timezone?: string): string {
  if (!value || !value.trim()) {
    console.warn("Empty date value, skipping");
    return "";
  }
  const trimmed = value.trim();

  // DD/MM/YYYY HH:MM:SS or DD/MM/YY HH:MM:SS (allow trailing content)
  const match = trimmed.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (match) {
    const [, day, month, rawYear, hours, minutes, seconds] = match;
    let year = parseInt(rawYear);
    if (year < 100) year += 2000;
    const yearStr = String(year);
    const tz = timezone?.trim().toUpperCase() === "GMT" ? "Z" : "";
    const iso = `${yearStr}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes}:${seconds ?? "00"}${tz}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // DD/MM/YYYY or DD/MM/YY (no time, allow trailing content)
  const dateOnly = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (dateOnly) {
    let year = parseInt(dateOnly[3]);
    if (year < 100) year += 2000;
    const d = new Date(
      year,
      parseInt(dateOnly[2]) - 1,
      parseInt(dateOnly[1])
    );
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // YYYY-MM-DD (ISO-like)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  console.warn("Unparseable date:", trimmed);
  return "";
}

/**
 * Auto-import for the French exchange CSV format.
 * Columns:
 *   0: Type
 *   1: Date
 *   2: Fuseau horaire
 *   3: Montant reçu
 *   4: Monnaie ou jeton reçu
 *   5: Montant envoyé
 *   6: Monnaie ou jeton envoyé
 *   7: Frais
 *   8: Monnaie ou jeton des frais
 *   9: Exchange / Plateforme
 *  10: Description
 *  11: Label
 *  12: Prix du jeton du montant envoyé
 *  13: Prix du jeton du montant recu
 *  14: Prix du jeton des frais
 *  15: Adresse
 *  16: Transaction hash
 *  17: ID Externe
 */
export function mapFrenchExchangeRows(
  headers: string[],
  rows: string[][]
): Transaction[] {
  // Build a header index map for resilience to column order changes
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    idx[h.trim()] = i;
  });

  const col = {
    type: idx["Type"] ?? 0,
    date: idx["Date"] ?? 1,
    timezone: idx["Fuseau horaire"] ?? 2,
    receivedAmount: idx["Montant reçu"] ?? 3,
    receivedCurrency: idx["Monnaie ou jeton reçu"] ?? 4,
    sentAmount: idx["Montant envoyé"] ?? 5,
    sentCurrency: idx["Monnaie ou jeton envoyé"] ?? 6,
    fees: idx["Frais"] ?? 7,
    feeCurrency: idx["Monnaie ou jeton des frais"] ?? 8,
    exchange: idx["Exchange / Plateforme"] ?? 9,
    description: idx["Description"] ?? 10,
    label: idx["Label"] ?? 11,
    sentTokenPrice: idx["Prix du jeton du montant envoyé"] ?? 12,
    receivedTokenPrice: idx["Prix du jeton du montant recu"] ?? idx["Prix du jeton du montant reçu"] ?? 13,
    feeTokenPrice: idx["Prix du jeton des frais"] ?? 14,
    address: idx["Adresse"] ?? 15,
    txHash: idx["Transaction hash"] ?? 16,
    externalId: idx["ID Externe"] ?? 17,
  };

  const results: (Transaction | null)[] = rows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row): Transaction | null => {
      const get = (c: number) => row[c]?.trim() ?? "";

      const receivedAmount = parseNumber(get(col.receivedAmount));
      const receivedCurrency = get(col.receivedCurrency).toUpperCase();
      const sentAmount = parseNumber(get(col.sentAmount));
      const sentCurrency = get(col.sentCurrency).toUpperCase();
      const fees = parseNumber(get(col.fees));
      const feeCurrency = get(col.feeCurrency).toUpperCase();
      const sentTokenPrice = parseNumber(get(col.sentTokenPrice));
      const receivedTokenPrice = parseNumber(get(col.receivedTokenPrice));
      const feeTokenPrice = parseNumber(get(col.feeTokenPrice));
      const exchange = get(col.exchange);
      const description = get(col.description);
      const label = get(col.label);
      const date = parseFrenchDate(get(col.date), get(col.timezone));

      // Compute fees in EUR
      let feesEur = 0;
      if (fees > 0) {
        if (isFiat(feeCurrency)) {
          feesEur = fees;
        } else if (feeTokenPrice > 0) {
          feesEur = fees * feeTokenPrice;
        }
      }

      const labelLower = label.toLowerCase();

      // ---- Label-based routing (primary) ----

      // "Achat de crypto" → BUY
      if (labelLower.includes("achat de crypto")) {
        const totalEur = isFiat(sentCurrency) ? sentAmount : receivedAmount * receivedTokenPrice;
        const pricePerUnit =
          receivedTokenPrice > 0
            ? receivedTokenPrice
            : receivedAmount > 0
              ? totalEur / receivedAmount
              : 0;

        return {
          id: generateId(),
          date,
          type: "buy" as const,
          asset: receivedCurrency,
          quantity: receivedAmount,
          pricePerUnit,
          totalEur,
          fees: feesEur,
          exchange,
          notes: [description, label].filter(Boolean).join(" - "),
        };
      }

      // "Masternode & stacking" / "Autre gain" → staking/lending revenue
      // French law: acquired for free (0 EUR acquisition cost)
      // Adds to holdings but NOT to total acquisition cost
      if (labelLower.includes("masternode") || labelLower.includes("stacking") || labelLower.includes("autre gain")) {
        const pricePerUnit = 0;
        const totalEur = 0;

        return {
          id: generateId(),
          date,
          type: "revenue" as const,
          asset: receivedCurrency,
          quantity: receivedAmount,
          pricePerUnit,
          totalEur,
          fees: feesEur,
          exchange,
          notes: [description, label].filter(Boolean).join(" - "),
        };
      }

      // "Swap" → crypto-to-crypto SWAP
      if (labelLower === "swap") {
        let totalEur = 0;
        if (sentTokenPrice > 0) {
          totalEur = sentAmount * sentTokenPrice;
        } else if (receivedTokenPrice > 0) {
          totalEur = receivedAmount * receivedTokenPrice;
        }

        return {
          id: generateId(),
          date,
          type: "swap" as const,
          fromAsset: sentCurrency,
          fromQuantity: sentAmount,
          toAsset: receivedCurrency,
          toQuantity: receivedAmount,
          totalEur,
          fees: feesEur,
          exchange,
          notes: [description, label].filter(Boolean).join(" - "),
        };
      }

      // "Transfert entre comptes" → internal transfer (not a taxable event)
      if (labelLower.includes("transfert entre compte")) {
        const asset = sentCurrency || receivedCurrency;
        const quantity = sentAmount || receivedAmount;
        return {
          id: generateId(),
          date,
          type: "transfer" as const,
          asset,
          quantity,
          pricePerUnit: sentTokenPrice || receivedTokenPrice || 0,
          totalEur: 0,
          fees: feesEur,
          exchange,
          notes: [description, label].filter(Boolean).join(" - "),
        };
      }

      // "Paiement" → taxable sale (crypto used to pay for goods/services)
      if (labelLower.includes("paiement")) {
        const totalEur = sentAmount * sentTokenPrice;
        return {
          id: generateId(),
          date,
          type: "sell" as const,
          asset: sentCurrency,
          quantity: sentAmount,
          pricePerUnit: sentTokenPrice,
          totalEur,
          fees: feesEur,
          exchange,
          notes: `Paiement. ${[description, label].filter(Boolean).join(" - ")}`,
        };
      }

      // ---- Fallback: infer from currencies ----

      const receivedIsFiat = isFiat(receivedCurrency);
      const sentIsFiat = isFiat(sentCurrency);

      // Sent fiat, received crypto → BUY
      if (sentIsFiat && !receivedIsFiat && receivedAmount > 0) {
        const totalEur = sentAmount;
        const pricePerUnit =
          receivedTokenPrice > 0
            ? receivedTokenPrice
            : receivedAmount > 0
              ? totalEur / receivedAmount
              : 0;

        return {
          id: generateId(),
          date,
          type: "buy" as const,
          asset: receivedCurrency,
          quantity: receivedAmount,
          pricePerUnit,
          totalEur,
          fees: feesEur,
          exchange,
          notes: [description, label].filter(Boolean).join(" - "),
        };
      }

      // Sent crypto, received fiat → SELL
      if (!sentIsFiat && receivedIsFiat && sentAmount > 0) {
        const totalEur = receivedAmount;
        const pricePerUnit =
          sentTokenPrice > 0
            ? sentTokenPrice
            : sentAmount > 0
              ? totalEur / sentAmount
              : 0;

        return {
          id: generateId(),
          date,
          type: "sell" as const,
          asset: sentCurrency,
          quantity: sentAmount,
          pricePerUnit,
          totalEur,
          fees: feesEur,
          exchange,
          notes: [description, label].filter(Boolean).join(" - "),
        };
      }

      // Both crypto → SWAP
      if (!sentIsFiat && !receivedIsFiat && sentAmount > 0 && receivedAmount > 0) {
        let totalEur = 0;
        if (sentTokenPrice > 0) {
          totalEur = sentAmount * sentTokenPrice;
        } else if (receivedTokenPrice > 0) {
          totalEur = receivedAmount * receivedTokenPrice;
        }

        return {
          id: generateId(),
          date,
          type: "swap" as const,
          fromAsset: sentCurrency,
          fromQuantity: sentAmount,
          toAsset: receivedCurrency,
          toQuantity: receivedAmount,
          totalEur,
          fees: feesEur,
          exchange,
          notes: [description, label].filter(Boolean).join(" - "),
        };
      }

      // Unknown or irrelevant — skip
      return null;
    });

  return results.filter((tx): tx is Transaction => {
    if (tx === null || tx.date === "") return false;
    if (tx.type === "swap") {
      if (!tx.fromQuantity && !tx.toQuantity) return false;
    } else {
      if (!tx.quantity) return false;
    }
    return true;
  });
}

// ---- Generic CSV mapping (kept for non-French-exchange CSVs) ----

function parseDate(value: string | undefined): string {
  return parseFrenchDate(value);
}

function normalizeType(value: string | undefined): "buy" | "sell" | "swap" | "revenue" {
  if (!value) return "buy";
  const lower = value.trim().toLowerCase();
  if (lower === "sell" || lower === "vente" || lower === "sale") return "sell";
  if (
    lower === "swap" ||
    lower === "exchange" ||
    lower === "échange" ||
    lower === "echange" ||
    lower === "convert"
  )
    return "swap";
  if (
    lower === "revenue" ||
    lower === "staking" ||
    lower === "mining" ||
    lower === "lending" ||
    lower === "reward"
  )
    return "revenue";
  return "buy";
}

export function mapRowsToTransactions(
  rows: string[][],
  mapping: ColumnMapping
): Transaction[] {
  return rows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const getValue = (colIndex: number | undefined): string | undefined =>
        colIndex !== undefined ? row[colIndex]?.trim() : undefined;

      const type = normalizeType(getValue(mapping.type));

      const tx: Transaction = {
        id: generateId(),
        date: parseDate(getValue(mapping.date)),
        type,
        fees: parseNumber(getValue(mapping.fees)),
        exchange: getValue(mapping.exchange) ?? "",
        notes: getValue(mapping.notes) ?? "",
      };

      if (type === "swap") {
        tx.fromAsset =
          getValue(mapping.fromAsset)?.toUpperCase() ??
          getValue(mapping.asset)?.toUpperCase();
        tx.fromQuantity = parseNumber(
          getValue(mapping.fromQuantity) ?? getValue(mapping.quantity)
        );
        tx.toAsset = getValue(mapping.toAsset)?.toUpperCase();
        tx.toQuantity = parseNumber(getValue(mapping.toQuantity));
        tx.totalEur = parseNumber(getValue(mapping.totalEur));
      } else {
        tx.asset = getValue(mapping.asset)?.toUpperCase();
        tx.quantity = parseNumber(getValue(mapping.quantity));
        tx.pricePerUnit = parseNumber(getValue(mapping.pricePerUnit));
        tx.totalEur = parseNumber(getValue(mapping.totalEur));

        // Derive missing values
        if (tx.quantity && tx.pricePerUnit && !tx.totalEur) {
          tx.totalEur = tx.quantity * tx.pricePerUnit;
        } else if (tx.totalEur && tx.quantity && !tx.pricePerUnit) {
          tx.pricePerUnit = tx.totalEur / tx.quantity;
        } else if (tx.totalEur && tx.pricePerUnit && !tx.quantity) {
          tx.quantity = tx.totalEur / tx.pricePerUnit;
        }
      }

      return tx;
    });
}
