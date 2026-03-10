import { useState, useEffect } from "react";
import type { Transaction } from "../types";
import { generateId } from "../lib/uuid";

interface Props {
  /** Pass a transaction to edit it, or null/undefined to create a new one */
  transaction?: Transaction | null;
  onSave: (tx: Transaction) => void;
  onCancel: () => void;
}

const TYPES = ["buy", "sell", "swap", "transfer", "revenue"] as const;

function toDateInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // Use local time components to match datetime-local input behavior
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromDateInputValue(val: string): string {
  if (!val) return "";
  // datetime-local gives "YYYY-MM-DDTHH:mm", interpret as local time
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

const emptyTx: Transaction = {
  id: "",
  date: "",
  type: "buy",
  asset: "",
  quantity: 0,
  pricePerUnit: 0,
  totalEur: 0,
  fees: 0,
  exchange: "",
  notes: "",
};

export default function TransactionForm({
  transaction,
  onSave,
  onCancel,
}: Props) {
  const isEdit = !!transaction;
  const [form, setForm] = useState<Transaction>(transaction ?? { ...emptyTx });

  useEffect(() => {
    setForm(transaction ?? { ...emptyTx });
  }, [transaction]);

  function set<K extends keyof Transaction>(key: K, value: Transaction[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setNum(key: keyof Transaction, raw: string) {
    const v = raw === "" ? 0 : parseFloat(raw);
    set(key, isNaN(v) ? 0 : v);
    setRawNums((prev) => ({ ...prev, [key]: raw }));
  }

  // Track raw input strings so typing "0" or "0.5" works naturally
  const [rawNums, setRawNums] = useState<Record<string, string>>({});

  // Reset raw strings when transaction changes
  useEffect(() => {
    setRawNums({});
  }, [transaction]);

  function numVal(v: number | undefined, key: string): string {
    if (key in rawNums) return rawNums[key];
    if (v === undefined || v === null) return "";
    return String(v);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const tx: Transaction = {
      ...form,
      id: isEdit ? form.id : generateId(),
      date: fromDateInputValue(toDateInputValue(form.date) || "") || form.date,
    };

    // Auto-derive totalEur if missing for buy/sell
    if (tx.type !== "swap" && tx.type !== "transfer") {
      if (tx.quantity && tx.pricePerUnit && !tx.totalEur) {
        tx.totalEur = tx.quantity * tx.pricePerUnit;
      } else if (tx.totalEur && tx.quantity && !tx.pricePerUnit) {
        tx.pricePerUnit = tx.totalEur / tx.quantity;
      }
    }

    onSave(tx);
  }

  const isSwap = form.type === "swap";
  const isTransfer = form.type === "transfer";
  const isRevenue = form.type === "revenue";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";
  const inputClass =
    "w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">
          {isEdit ? "Edit transaction" : "Add transaction"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Row 1: Date + Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={toDateInputValue(form.date)}
            onChange={(e) => set("date", fromDateInputValue(e.target.value))}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) =>
              set("type", e.target.value as Transaction["type"])
            }
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Swap fields */}
      {isSwap && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>From asset</label>
              <input
                className={inputClass}
                value={form.fromAsset ?? ""}
                onChange={(e) => set("fromAsset", e.target.value.toUpperCase())}
                placeholder="BTC"
                required
              />
            </div>
            <div>
              <label className={labelClass}>From quantity</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={numVal(form.fromQuantity, "fromQuantity")}
                onChange={(e) => setNum("fromQuantity", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>To asset</label>
              <input
                className={inputClass}
                value={form.toAsset ?? ""}
                onChange={(e) => set("toAsset", e.target.value.toUpperCase())}
                placeholder="ETH"
                required
              />
            </div>
            <div>
              <label className={labelClass}>To quantity</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={numVal(form.toQuantity, "toQuantity")}
                onChange={(e) => setNum("toQuantity", e.target.value)}
                required
              />
            </div>
          </div>
        </>
      )}

      {/* Buy / Sell / Transfer fields */}
      {!isSwap && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Asset</label>
              <input
                className={inputClass}
                value={form.asset ?? ""}
                onChange={(e) => set("asset", e.target.value.toUpperCase())}
                placeholder="BTC"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={numVal(form.quantity, "quantity")}
                onChange={(e) => setNum("quantity", e.target.value)}
                required
              />
            </div>
          </div>
          {!isTransfer && !isRevenue && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Price per unit (EUR)</label>
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={numVal(form.pricePerUnit, "pricePerUnit")}
                  onChange={(e) => setNum("pricePerUnit", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Total EUR</label>
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={numVal(form.totalEur, "totalEur")}
                  onChange={(e) => setNum("totalEur", e.target.value)}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Swap totalEur */}
      {isSwap && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Total EUR (estimated value)</label>
            <input
              type="number"
              step="any"
              className={inputClass}
              value={numVal(form.totalEur, "totalEur")}
              onChange={(e) => setNum("totalEur", e.target.value)}
            />
          </div>
          <div />
        </div>
      )}

      {/* Row: Fees + Exchange */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Fees (EUR)</label>
          <input
            type="number"
            step="any"
            className={inputClass}
            value={numVal(form.fees, "fees")}
            onChange={(e) => setNum("fees", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Exchange</label>
          <input
            className={inputClass}
            value={form.exchange}
            onChange={(e) => set("exchange", e.target.value)}
            placeholder="Binance"
          />
        </div>
      </div>

      {/* TxID */}
      <div>
        <label className={labelClass}>TxID (on-chain or exchange)</label>
        <input
          className={inputClass}
          value={form.txId ?? ""}
          onChange={(e) => set("txId", e.target.value)}
          placeholder="0xabc..."
        />
      </div>

      {/* Notes + Proof */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Notes</label>
          <input
            className={inputClass}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Proof (document or link)</label>
          <input
            className={inputClass}
            value={form.transactionProof ?? ""}
            onChange={(e) => set("transactionProof", e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
        >
          {isEdit ? "Save changes" : "Add transaction"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
