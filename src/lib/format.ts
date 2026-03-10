const SATS_PER_BTC = 100_000_000;

export function formatQty(value: number | undefined, asset?: string): string {
  if (value === undefined || value === null) return "-";
  if (asset?.toUpperCase() === "BTC") {
    const sats = Math.round(value * SATS_PER_BTC);
    return `${sats.toLocaleString("fr-FR")} sats`;
  }
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

export function formatEur(value: number | undefined): string {
  if (value === undefined || value === null) return "-";
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
