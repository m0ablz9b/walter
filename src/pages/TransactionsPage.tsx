import { useState, useMemo, useRef, useCallback } from "react";
import type { Transaction } from "../types";
import { formatEur } from "../lib/format";
import { exportTransactionsCsv } from "../lib/csv-export";
import { generateId } from "../lib/uuid";
import CsvImporter from "../components/CsvImporter";
import TransactionTable from "../components/TransactionTable";
import TransactionForm from "../components/TransactionForm";
import MultiSelect from "../components/MultiSelect";

interface Props {
  transactions: Transaction[];
  onImport: (txs: Transaction[]) => void;
  onDelete: (id: string) => void;
  onUpdate: (tx: Transaction) => void;
}

const TX_TYPES = ["buy", "sell", "swap", "transfer", "revenue"];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Max 48h between the two transfers
const MAX_DATE_DIFF_MS = 48 * 60 * 60 * 1000;
// Quantity tolerance: 5%
const QTY_TOLERANCE = 0.05;

function validateMerge(
  a: Transaction,
  b: Transaction
): { ok: true } | { ok: false; reason: string } {
  if (a.type !== "transfer" || b.type !== "transfer") {
    return { ok: false, reason: "Both transactions must be transfers." };
  }
  if (a.asset !== b.asset) {
    return {
      ok: false,
      reason: `Assets don't match: ${a.asset} vs ${b.asset}.`,
    };
  }
  const dateDiff = Math.abs(
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  if (dateDiff > MAX_DATE_DIFF_MS) {
    const hours = Math.round(dateDiff / (60 * 60 * 1000));
    return {
      ok: false,
      reason: `Dates are ${hours}h apart (max 48h).`,
    };
  }
  const qtyA = a.quantity ?? 0;
  const qtyB = b.quantity ?? 0;
  const maxQty = Math.max(qtyA, qtyB);
  if (maxQty > 0 && Math.abs(qtyA - qtyB) / maxQty > QTY_TOLERANCE) {
    return {
      ok: false,
      reason: `Quantities differ by more than 5%: ${qtyA} vs ${qtyB}.`,
    };
  }
  return { ok: true };
}

function mergeTransfers(a: Transaction, b: Transaction): Transaction {
  // Keep the earlier one as base
  const [earlier, later] =
    new Date(a.date).getTime() <= new Date(b.date).getTime()
      ? [a, b]
      : [b, a];

  const exchanges = [earlier.exchange, later.exchange].filter(Boolean);
  const uniqueExchanges = [...new Set(exchanges)];

  const notes = [earlier.notes, later.notes]
    .filter(Boolean)
    .join(" | ");

  return {
    ...earlier,
    quantity: Math.max(earlier.quantity ?? 0, later.quantity ?? 0),
    fees: earlier.fees + later.fees,
    exchange: uniqueExchanges.join(" → "),
    notes: notes || `Merged: ${earlier.id.slice(0, 8)} + ${later.id.slice(0, 8)}`,
    transactionProof: earlier.transactionProof || later.transactionProof,
  };
}

export default function TransactionsPage({
  transactions,
  onImport,
  onDelete,
  onUpdate,
}: Props) {
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [assetFilter, setAssetFilter] = useState<Set<string>>(new Set());
  const [exchangeFilter, setExchangeFilter] = useState<Set<string>>(new Set());
  const [yearFilter, setYearFilter] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Selection / merge / bulk edit state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");

  const { assets, exchanges, years } = useMemo(() => {
    const assetSet = new Set<string>();
    const exchangeSet = new Set<string>();
    const yearSet = new Set<number>();
    for (const tx of transactions) {
      if (tx.asset) assetSet.add(tx.asset);
      if (tx.fromAsset) assetSet.add(tx.fromAsset);
      if (tx.toAsset) assetSet.add(tx.toAsset);
      if (tx.exchange) exchangeSet.add(tx.exchange);
      const y = new Date(tx.date).getFullYear();
      if (!isNaN(y)) yearSet.add(y);
    }
    return {
      assets: [...assetSet].sort(),
      exchanges: [...exchangeSet].sort(),
      years: [...yearSet].sort((a, b) => b - a).map(String),
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter.size > 0 && !typeFilter.has(tx.type)) return false;
      if (assetFilter.size > 0) {
        const match =
          (tx.asset && assetFilter.has(tx.asset)) ||
          (tx.fromAsset && assetFilter.has(tx.fromAsset)) ||
          (tx.toAsset && assetFilter.has(tx.toAsset));
        if (!match) return false;
      }
      if (exchangeFilter.size > 0 && !exchangeFilter.has(tx.exchange))
        return false;
      if (yearFilter.size > 0) {
        const y = String(new Date(tx.date).getFullYear());
        if (!yearFilter.has(y)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, assetFilter, exchangeFilter, yearFilter]);

  const hasFilters =
    typeFilter.size > 0 ||
    assetFilter.size > 0 ||
    exchangeFilter.size > 0 ||
    yearFilter.size > 0;

  function handleSave(tx: Transaction) {
    if (editingTx) {
      onUpdate(tx);
    } else {
      onImport([tx]);
    }
    setShowForm(false);
    setEditingTx(null);
  }

  function handleEdit(tx: Transaction) {
    setEditingTx(tx);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingTx(null);
  }

  function clearFilters() {
    setTypeFilter(new Set());
    setAssetFilter(new Set());
    setExchangeFilter(new Set());
    setYearFilter(new Set());
  }

  const selectAll = useCallback((ids: string[]) => {
    setMergeError(null);
    setSelected(new Set(ids));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setMergeError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelected(new Set());
    setMergeError(null);
    setBulkEditField("");
    setBulkEditValue("");
    setShowForm(false);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
    setMergeError(null);
    setBulkEditField("");
    setBulkEditValue("");
  }

  function handleMerge() {
    if (selected.size !== 2) return;
    const ids = [...selected];
    const txA = transactions.find((t) => t.id === ids[0]);
    const txB = transactions.find((t) => t.id === ids[1]);
    if (!txA || !txB) return;

    const result = validateMerge(txA, txB);
    if (!result.ok) {
      setMergeError(result.reason);
      return;
    }

    const merged = mergeTransfers(txA, txB);
    onUpdate(merged);
    // Delete the other one
    const otherId = merged.id === txA.id ? txB.id : txA.id;
    onDelete(otherId);

    exitSelectionMode();
  }

  const BULK_FIELDS = [
    { key: "type", label: "Type" },
    { key: "asset", label: "Asset" },
    { key: "exchange", label: "Exchange" },
    { key: "notes", label: "Notes" },
    { key: "txId", label: "TxID" },
    { key: "transactionProof", label: "Proof" },
  ];

  function handleBulkEdit() {
    if (!bulkEditField || selected.size === 0) return;
    for (const id of selected) {
      const tx = transactions.find((t) => t.id === id);
      if (!tx) continue;
      onUpdate({ ...tx, [bulkEditField]: bulkEditValue });
    }
    exitSelectionMode();
  }

  const canMerge =
    selected.size === 2 &&
    [...selected].every((id) => {
      const tx = transactions.find((t) => t.id === id);
      return tx?.type === "transfer";
    });

  const totals = useMemo(() => {
    let totalBuy = 0;
    let totalSell = 0;
    let totalFees = 0;
    let buyCount = 0;
    let sellCount = 0;
    for (const tx of filtered) {
      if (tx.type === "buy") {
        totalBuy += tx.totalEur ?? 0;
        buyCount++;
      } else if (tx.type === "sell") {
        totalSell += tx.totalEur ?? 0;
        sellCount++;
      }
      totalFees += tx.fees;
    }
    return { totalBuy, totalSell, totalFees, buyCount, sellCount };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Transactions</h2>
          <p className="text-sm text-gray-500">
            Import your transaction history from CSV files or add them manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showForm && !selectionMode && (
            <>
              <button
                onClick={() => exportTransactionsCsv(filtered)}
                disabled={filtered.length === 0}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export CSV
              </button>
              <button
                onClick={enterSelectionMode}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50"
              >
                Select
              </button>
              <button
                onClick={() => {
                  setEditingTx(null);
                  setShowForm(true);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
              >
                + Add transaction
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selection mode toolbar */}
      {selectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              <span className="font-medium">Selection mode</span>
              {selected.size > 0 && (
                <span className="ml-1 font-medium">
                  ({selected.size} selected)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {mergeError && (
                <span className="text-sm text-red-600">{mergeError}</span>
              )}
              <button
                onClick={handleMerge}
                disabled={!canMerge}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Select exactly 2 transfers to merge"
              >
                Merge transfers
              </button>
              <button
                onClick={exitSelectionMode}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Bulk edit */}
          {selected.size > 0 && (
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">
                  Field
                </label>
                <select
                  value={bulkEditField}
                  onChange={(e) => {
                    setBulkEditField(e.target.value);
                    setBulkEditValue("");
                  }}
                  className="border border-blue-300 rounded px-2 py-1.5 text-sm bg-white"
                >
                  <option value="">Choose field...</option>
                  {BULK_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              {bulkEditField && (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    New value
                  </label>
                  {bulkEditField === "type" ? (
                    <select
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      className="border border-blue-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">Choose type...</option>
                      {TX_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {capitalize(t)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={bulkEditValue}
                      onChange={(e) => setBulkEditValue(e.target.value)}
                      className="border border-blue-300 rounded px-2 py-1.5 text-sm bg-white"
                      placeholder={`New ${BULK_FIELDS.find((f) => f.key === bulkEditField)?.label ?? "value"}...`}
                    />
                  )}
                </div>
              )}
              {bulkEditField && bulkEditValue && (
                <button
                  onClick={handleBulkEdit}
                  className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700"
                >
                  Apply to {selected.size} transaction{selected.size > 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div ref={formRef} className="bg-white rounded-lg border border-gray-200 p-5">
          <TransactionForm
            transaction={editingTx}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {!showForm && !selectionMode && <CsvImporter onImport={onImport} />}

      {/* Filters */}
      {transactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <MultiSelect
            label="All types"
            options={TX_TYPES}
            selected={typeFilter}
            onChange={setTypeFilter}
            formatOption={capitalize}
          />

          <MultiSelect
            label="All assets"
            options={assets}
            selected={assetFilter}
            onChange={setAssetFilter}
          />

          <MultiSelect
            label="All exchanges"
            options={exchanges}
            selected={exchangeFilter}
            onChange={setExchangeFilter}
          />

          <MultiSelect
            label="All years"
            options={years}
            selected={yearFilter}
            onChange={setYearFilter}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <TransactionTable
          transactions={filtered}
          onDelete={onDelete}
          onEdit={handleEdit}
          selectionMode={selectionMode}
          selected={selected}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
        />
      </div>

      {transactions.length === 0 && !showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Getting started</h3>
            <p className="text-sm text-gray-500 mt-1">
              New here? Load some sample transactions to see how Walter works,
              then export them as CSV to use as a template for your own data.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                const now = new Date();
                const d1 = new Date(now.getFullYear() - 1, 2, 15, 10, 30);
                const d2 = new Date(now.getFullYear() - 1, 5, 20, 14, 0);
                const d3 = new Date(now.getFullYear(), 0, 10, 9, 15);
                const samples: Transaction[] = [
                  {
                    id: generateId(),
                    date: d1.toISOString(),
                    type: "buy",
                    asset: "BTC",
                    quantity: 0.05,
                    pricePerUnit: 85000,
                    totalEur: 4250,
                    fees: 9.5,
                    exchange: "Binance",
                    notes: "Sample buy",
                  },
                  {
                    id: generateId(),
                    date: d2.toISOString(),
                    type: "swap",
                    fromAsset: "BTC",
                    fromQuantity: 0.01,
                    toAsset: "ETH",
                    toQuantity: 0.18,
                    totalEur: 250,
                    fees: 1.2,
                    exchange: "Binance",
                    notes: "Sample swap",
                  },
                  {
                    id: generateId(),
                    date: d3.toISOString(),
                    type: "sell",
                    asset: "ETH",
                    quantity: 0.18,
                    pricePerUnit: 1800,
                    totalEur: 324,
                    fees: 2.0,
                    exchange: "Kraken",
                    notes: "Sample sell",
                  },
                ];
                onImport(samples);
              }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700"
            >
              Load sample transactions
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Once loaded, click <strong>Export CSV</strong> to get a template you can fill with your own transactions.
          </p>
        </div>
      )}

      {filtered.length > 0 && !selectionMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">
              Total bought ({totals.buyCount})
            </div>
            <div className="text-lg font-semibold mt-0.5 text-green-700">
              {formatEur(totals.totalBuy)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">
              Total sold ({totals.sellCount})
            </div>
            <div className="text-lg font-semibold mt-0.5 text-red-700">
              {formatEur(totals.totalSell)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Total fees</div>
            <div className="text-lg font-semibold mt-0.5 text-gray-700">
              {formatEur(totals.totalFees)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">
              Taxable volume (sells)
            </div>
            <div className="text-lg font-semibold mt-0.5 text-gray-900">
              {formatEur(totals.totalSell)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              PFU 31.4% = {formatEur(totals.totalSell * 0.314)} max
            </div>
          </div>
        </div>
      )}

      {transactions.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {hasFilters
            ? `${filtered.length} of ${transactions.length} transaction${transactions.length > 1 ? "s" : ""}`
            : `${transactions.length} transaction${transactions.length > 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  );
}
