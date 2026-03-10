import { useState, useCallback } from "react";
import type { Transaction } from "../types";
import type { CsvParseResult, ColumnMapping } from "../lib/csv";
import {
  parseCsvFile,
  mapRowsToTransactions,
  mapFrenchExchangeRows,
} from "../lib/csv";

interface Props {
  onImport: (transactions: Transaction[]) => void;
}

const FIELD_OPTIONS = [
  { value: "", label: "-- Skip --" },
  { value: "date", label: "Date" },
  { value: "type", label: "Type (buy/sell/swap)" },
  { value: "asset", label: "Asset" },
  { value: "quantity", label: "Quantity" },
  { value: "pricePerUnit", label: "Price per unit (EUR)" },
  { value: "totalEur", label: "Total (EUR)" },
  { value: "fees", label: "Fees (EUR)" },
  { value: "exchange", label: "Exchange" },
  { value: "notes", label: "Notes" },
  { value: "fromAsset", label: "Swap: From Asset" },
  { value: "fromQuantity", label: "Swap: From Quantity" },
  { value: "toAsset", label: "Swap: To Asset" },
  { value: "toQuantity", label: "Swap: To Quantity" },
];

function guessMapping(columns: CsvParseResult["columns"]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const guesses: Record<string, string[]> = {
    date: ["date", "datetime", "time", "timestamp", "dat"],
    type: ["type", "side", "operation", "action", "direction"],
    asset: ["asset", "coin", "currency", "symbol", "crypto", "ticker", "pair"],
    quantity: ["quantity", "amount", "qty", "size", "volume"],
    pricePerUnit: ["price", "rate", "prix", "unit_price", "price_per_unit"],
    totalEur: ["total", "total_eur", "eur", "fiat", "value", "cost", "montant"],
    fees: ["fee", "fees", "commission", "frais"],
    exchange: ["exchange", "platform", "source", "plateforme"],
    notes: ["notes", "note", "memo", "comment", "description"],
    fromAsset: ["from_asset", "from_coin", "from_currency", "sell_asset"],
    fromQuantity: [
      "from_quantity",
      "from_amount",
      "sell_quantity",
      "sell_amount",
    ],
    toAsset: ["to_asset", "to_coin", "to_currency", "buy_asset"],
    toQuantity: ["to_quantity", "to_amount", "buy_quantity", "buy_amount"],
  };

  for (const [field, keywords] of Object.entries(guesses)) {
    const colIndex = columns.findIndex((col) =>
      keywords.some((kw) => col.header.toLowerCase().includes(kw))
    );
    if (colIndex !== -1) {
      (mapping as Record<string, number>)[field] = colIndex;
    }
  }

  return mapping;
}

export default function CsvImporter({ onImport }: Props) {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const result = await parseCsvFile(file);
      setParseResult(result);

      if (result.detectedFormat === "french-exchange") {
        // Auto-import: no column mapping needed
        // We still show the preview for confirmation
      } else {
        setMapping(guessMapping(result.columns));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleMappingChange = (field: string, colIndex: number | undefined) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (colIndex === undefined) {
        delete (next as Record<string, number | undefined>)[field];
      } else {
        (next as Record<string, number>)[field] = colIndex;
      }
      return next;
    });
  };

  const handleImport = () => {
    if (!parseResult) return;
    try {
      let transactions: Transaction[];

      if (parseResult.detectedFormat === "french-exchange") {
        const headers = parseResult.columns.map((c) => c.header);
        transactions = mapFrenchExchangeRows(headers, parseResult.rows);
      } else {
        transactions = mapRowsToTransactions(parseResult.rows, mapping);
      }

      onImport(transactions);
      setParseResult(null);
      setMapping({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to map transactions");
    }
  };

  const isFrenchFormat = parseResult?.detectedFormat === "french-exchange";

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!parseResult && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <p className="text-gray-600 mb-2">
            Drag & drop a CSV file here, or click to browse
          </p>
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileInput}
            className="block mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Preview + import */}
      {parseResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">
                {isFrenchFormat
                  ? `French exchange format detected (${parseResult.totalRows} rows)`
                  : `Map CSV columns (${parseResult.totalRows} rows)`}
              </h3>
              {isFrenchFormat && (
                <p className="text-sm text-green-600 mt-1">
                  Auto-detected format: columns will be mapped automatically.
                  Deposits/withdrawals are handled, swaps are tracked.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setParseResult(null);
                  setMapping({});
                }}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Import {parseResult.totalRows} rows
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  {parseResult.columns.map((col, i) => (
                    <th key={i} className="px-3 py-2 text-left">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-700">
                          {col.header}
                        </div>
                        {/* Only show mapping dropdowns for generic format */}
                        {!isFrenchFormat && (
                          <select
                            value={
                              Object.entries(mapping).find(
                                ([, v]) => v === i
                              )?.[0] ?? ""
                            }
                            onChange={(e) =>
                              handleMappingChange(
                                e.target.value,
                                e.target.value ? i : undefined
                              )
                            }
                            className="block w-full rounded-md border-gray-300 text-xs py-1 bg-white border shadow-sm"
                          >
                            {FIELD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parseResult.rows.slice(0, 5).map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-50">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 text-gray-600 whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
