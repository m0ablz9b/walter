import type { EngineResult } from "../lib/engine";
import type { usePriceFetcher } from "../hooks/usePriceFetcher";
import HoldingsOverview from "../components/HoldingsOverview";
import PortfolioChart from "../components/PortfolioChart";

interface Props {
  engineResult: EngineResult;
  priceFetcher: ReturnType<typeof usePriceFetcher>;
}

export default function PortfolioPage({ engineResult, priceFetcher }: Props) {
  const { snapshots, warnings } = engineResult;
  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const { status, fetchMissingPrices, abort, missingCount } = priceFetcher;

  const priceWarnings = warnings.filter((w) => w.type === "missing_price");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Portfolio</h2>
        <p className="text-sm text-gray-500">
          Current holdings and portfolio value over time.
        </p>
      </div>

      {(priceWarnings.length > 0 || missingCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <strong>Missing prices:</strong> {missingCount} price
              {missingCount > 1 ? "s" : ""} could not be resolved.
              {priceWarnings.length > 0 && (
                <ul className="mt-1 list-disc list-inside">
                  {priceWarnings.slice(0, 5).map((w, i) => (
                    <li key={i}>
                      {new Date(w.date).toLocaleDateString("fr-FR")}: {w.message}
                    </li>
                  ))}
                  {priceWarnings.length > 5 && (
                    <li>...and {priceWarnings.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
            <div className="shrink-0">
              {!status.isFetching ? (
                <button
                  onClick={fetchMissingPrices}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
                >
                  Fetch prices
                </button>
              ) : (
                <div className="text-xs">
                  <span>
                    {status.progress.done}/{status.progress.total}
                  </span>
                  <button
                    onClick={abort}
                    className="ml-2 text-amber-700 underline"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <HoldingsOverview snapshot={lastSnapshot} />

      <div>
        <h3 className="text-lg font-medium mb-3">Portfolio Value Over Time</h3>
        <PortfolioChart snapshots={snapshots} />
      </div>
    </div>
  );
}
