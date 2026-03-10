import type { Transaction } from "../types";

const HEADERS = [
  "Date",
  "Type",
  "Asset",
  "Quantity",
  "Price/Unit (EUR)",
  "Total EUR",
  "From Asset",
  "From Quantity",
  "To Asset",
  "To Quantity",
  "Fees (EUR)",
  "Exchange",
  "Notes",
  "TxID",
  "Proof",
];

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function txToRow(tx: Transaction): string {
  const cols = [
    tx.date,
    tx.type,
    tx.asset ?? "",
    tx.quantity?.toString() ?? "",
    tx.pricePerUnit?.toString() ?? "",
    tx.totalEur?.toString() ?? "",
    tx.fromAsset ?? "",
    tx.fromQuantity?.toString() ?? "",
    tx.toAsset ?? "",
    tx.toQuantity?.toString() ?? "",
    tx.fees.toString(),
    tx.exchange,
    tx.notes,
    tx.txId ?? "",
    tx.transactionProof ?? "",
  ];
  return cols.map(escapeCsv).join(",");
}

export function exportTransactionsCsv(transactions: Transaction[]): void {
  const lines = [HEADERS.join(",")];
  for (const tx of transactions) {
    lines.push(txToRow(tx));
  }
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `walter-transactions-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
