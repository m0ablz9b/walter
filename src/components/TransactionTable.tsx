import { useState, useMemo } from "react";
import type { Transaction } from "../types";
import { formatDate, formatEur, formatQty } from "../lib/format";

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
  selectionMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
}

const typeBadge: Record<string, string> = {
  buy: "bg-green-100 text-green-800",
  sell: "bg-red-100 text-red-800",
  swap: "bg-blue-100 text-blue-800",
  transfer: "bg-gray-100 text-gray-600",
  revenue: "bg-yellow-100 text-yellow-800",
};

type SortKey = "date" | "type" | "asset" | "quantity" | "totalEur" | "fees" | "exchange";
type SortDir = "asc" | "desc";

function getAsset(tx: Transaction): string {
  if (tx.type === "swap") return `${tx.fromAsset ?? ""} → ${tx.toAsset ?? ""}`;
  return tx.asset ?? "";
}

function getQuantity(tx: Transaction): number {
  if (tx.type === "swap") return tx.fromQuantity ?? 0;
  return tx.quantity ?? 0;
}

function compareTx(a: Transaction, b: Transaction, key: SortKey): number {
  switch (key) {
    case "date":
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    case "type":
      return a.type.localeCompare(b.type);
    case "asset":
      return getAsset(a).localeCompare(getAsset(b));
    case "quantity":
      return getQuantity(a) - getQuantity(b);
    case "totalEur":
      return (a.totalEur ?? 0) - (b.totalEur ?? 0);
    case "fees":
      return a.fees - b.fees;
    case "exchange":
      return a.exchange.localeCompare(b.exchange);
    default:
      return 0;
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function TransactionTable({
  transactions,
  onDelete,
  onEdit,
  selectionMode,
  selected,
  onToggleSelect,
  onSelectAll,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      const cmp = compareTx(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No transactions yet. Import a CSV file to get started.
      </div>
    );
  }

  const thClass = "px-3 py-2 cursor-pointer select-none hover:text-gray-700";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 uppercase text-xs">
            {selectionMode && (
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && sorted.every((tx) => selected?.has(tx.id))}
                  onChange={() => {
                    const allSelected = sorted.every((tx) => selected?.has(tx.id));
                    onSelectAll?.(allSelected ? [] : sorted.map((tx) => tx.id));
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
            )}
            <th className={thClass} onClick={() => toggleSort("date")}>
              Date <SortIcon active={sortKey === "date"} dir={sortDir} />
            </th>
            <th className={thClass} onClick={() => toggleSort("type")}>
              Type <SortIcon active={sortKey === "type"} dir={sortDir} />
            </th>
            <th className={thClass} onClick={() => toggleSort("asset")}>
              Asset <SortIcon active={sortKey === "asset"} dir={sortDir} />
            </th>
            <th
              className={`${thClass} text-right`}
              onClick={() => toggleSort("quantity")}
            >
              Quantity <SortIcon active={sortKey === "quantity"} dir={sortDir} />
            </th>
            <th className="px-3 py-2 text-right">Price/Unit</th>
            <th
              className={`${thClass} text-right`}
              onClick={() => toggleSort("totalEur")}
            >
              Total EUR{" "}
              <SortIcon active={sortKey === "totalEur"} dir={sortDir} />
            </th>
            <th
              className={`${thClass} text-right`}
              onClick={() => toggleSort("fees")}
            >
              Fees <SortIcon active={sortKey === "fees"} dir={sortDir} />
            </th>
            <th className={thClass} onClick={() => toggleSort("exchange")}>
              Exchange{" "}
              <SortIcon active={sortKey === "exchange"} dir={sortDir} />
            </th>
            <th className="px-3 py-2">TxID</th>
            <th className="px-3 py-2">Proof</th>
            {!selectionMode && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((tx) => {
            const isSelected = selected?.has(tx.id);
            return (
              <tr
                key={tx.id}
                className={`${
                  isSelected
                    ? "bg-blue-50"
                    : "hover:bg-gray-50"
                }`}
              >
                {selectionMode && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected ?? false}
                      onChange={() => onToggleSelect?.(tx.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                )}
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDate(tx.date)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      typeBadge[tx.type] ?? ""
                    }`}
                  >
                    {tx.type}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">
                  {tx.type === "swap"
                    ? `${tx.fromAsset} → ${tx.toAsset}`
                    : tx.asset}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {tx.type === "swap"
                    ? `${formatQty(tx.fromQuantity, tx.fromAsset)} → ${formatQty(tx.toQuantity, tx.toAsset)}`
                    : formatQty(tx.quantity, tx.asset)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {tx.type === "swap" || tx.type === "revenue" ? "-" : formatEur(tx.pricePerUnit)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {tx.type === "revenue" ? "-" : formatEur(tx.totalEur)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEur(tx.fees)}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {tx.type === "transfer" && tx.exchange.includes("→") ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                        {tx.exchange.split("→")[0].trim()}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                        {tx.exchange.split("→")[1].trim()}
                      </span>
                    </span>
                  ) : (
                    tx.exchange
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                  {tx.txId ? (
                    <span className="text-xs font-mono" title={tx.txId}>
                      {tx.txId.length > 16
                        ? `${tx.txId.slice(0, 8)}...${tx.txId.slice(-6)}`
                        : tx.txId}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                  {tx.transactionProof ? (
                    tx.transactionProof.startsWith("http") ? (
                      <a
                        href={tx.transactionProof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-xs underline"
                      >
                        Link
                      </a>
                    ) : (
                      <span className="text-xs" title={tx.transactionProof}>
                        {tx.transactionProof}
                      </span>
                    )
                  ) : null}
                </td>
                {!selectionMode && (
                  <td className="px-3 py-2 whitespace-nowrap space-x-1">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(tx)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(tx.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
