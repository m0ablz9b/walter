import { useState, useMemo } from "react";
import type { AppState } from "../types";
import { useEngineForYear } from "../hooks/useEngine";
import type { EngineWarning } from "../lib/engine";
import TaxSummary from "../components/TaxSummary";

interface Props {
  state: AppState;
}

export default function TaxReportPage({ state }: Props) {
  // Determine available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const tx of state.transactions) {
      years.add(new Date(tx.date).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [state.transactions]);

  const [selectedYear, setSelectedYear] = useState<number>(
    availableYears[0] ?? new Date().getFullYear()
  );

  const { report, fullResult } = useEngineForYear(state, selectedYear);

  const yearWarnings = fullResult.warnings.filter(
    (w: EngineWarning) => new Date(w.date).getFullYear() === selectedYear
  );

  if (state.transactions.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Tax Report</h2>
        <div className="text-center py-12 text-gray-500">
          No transactions loaded. Import transactions first.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Tax Report</h2>
          <p className="text-sm text-gray-500">
            Capital gains computed per Article 150 VH bis CGI. Flat tax 30%
            (PFU).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Fiscal year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm text-sm bg-white border px-3 py-1.5"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {yearWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm">
          <strong>Warnings for {selectedYear}:</strong>
          <ul className="mt-1 list-disc list-inside">
            {yearWarnings.map((w, i) => (
              <li key={i}>
                {new Date(w.date).toLocaleDateString("fr-FR")}: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report ? (
        <TaxSummary report={report} />
      ) : (
        <div className="text-center py-12 text-gray-500">
          No sales (crypto → fiat) recorded for {selectedYear}.
        </div>
      )}

      <div className="text-xs text-gray-400 border-t border-gray-200 pt-4">
        This tool provides estimates for information purposes only. It does not
        constitute tax advice. Please consult a qualified tax professional for
        your official tax return.
      </div>
    </div>
  );
}
