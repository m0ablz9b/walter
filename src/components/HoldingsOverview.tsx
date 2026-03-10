import type { PortfolioSnapshot } from "../types";
import { formatEur, formatQty } from "../lib/format";

interface Props {
  snapshot: PortfolioSnapshot | null;
}

export default function HoldingsOverview({ snapshot }: Props) {
  if (!snapshot || Object.keys(snapshot.holdings).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No holdings to display.
      </div>
    );
  }

  const holdingEntries = Object.entries(snapshot.holdings)
    .filter(([, qty]) => qty > 0)
    .map(([asset, qty]) => ({
      asset,
      quantity: qty,
      price: snapshot.prices[asset] ?? 0,
      value: qty * (snapshot.prices[asset] ?? 0),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Portfolio Value</div>
          <div className="text-2xl font-semibold mt-1">
            {formatEur(snapshot.globalPortfolioValue)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Acquisition Cost</div>
          <div className="text-2xl font-semibold mt-1">
            {formatEur(snapshot.totalAcquisitionCost)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Unrealized P/L</div>
          <div
            className={`text-2xl font-semibold mt-1 ${
              snapshot.globalPortfolioValue - snapshot.totalAcquisitionCost >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {formatEur(
              snapshot.globalPortfolioValue - snapshot.totalAcquisitionCost
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 uppercase text-xs">
              <th className="px-4 py-2">Asset</th>
              <th className="px-4 py-2 text-right">Quantity</th>
              <th className="px-4 py-2 text-right">Last Price</th>
              <th className="px-4 py-2 text-right">Value</th>
              <th className="px-4 py-2 text-right">% of Portfolio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {holdingEntries.map((h) => (
              <tr key={h.asset} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{h.asset}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatQty(h.quantity, h.asset)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatEur(h.price)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatEur(h.value)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {snapshot.globalPortfolioValue > 0
                    ? ((h.value / snapshot.globalPortfolioValue) * 100).toFixed(1)
                    : "0"}
                  %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
