import { useRef, useState } from "react";
import { exportStateAsJson } from "../lib/storage";
import type { usePriceFetcher } from "../hooks/usePriceFetcher";

interface Props {
  onClearAll: () => void;
  onImportState: (json: string) => void;
  transactionCount: number;
  priceFetcher: ReturnType<typeof usePriceFetcher>;
  cryptoCompareApiKey: string;
  onSetCryptoCompareApiKey: (key: string) => void;
}

export default function SettingsPage({
  onClearAll,
  onImportState,
  transactionCount,
  priceFetcher,
  cryptoCompareApiKey,
  onSetCryptoCompareApiKey,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const { status, fetchMissingPrices, abort, missingCount } = priceFetcher;

  const handleExport = () => {
    const json = exportStateAsJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `walter-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      onImportState(text);
      setImportSuccess(true);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Failed to import data"
      );
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    onClearAll();
    setConfirmClear(false);
  };

  const storageUsed = (() => {
    try {
      const json = exportStateAsJson();
      return (new Blob([json]).size / 1024).toFixed(1);
    } catch {
      return "?";
    }
  })();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold mb-1">Settings</h2>
        <p className="text-sm text-gray-500">
          Manage your data: export, import, or clear everything.
        </p>
      </div>

      {/* Privacy */}
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
        <span className="font-medium">Your data never leaves your browser.</span>{" "}
        Walter runs entirely client-side. All transactions, prices, and settings
        are stored in your browser's localStorage. No server, no database, no
        tracking, no analytics. 
        <br></br>
        The only external requests are to CryptoCompare
        for historical prices, and only when you explicitly trigger a fetch. 
        These requests do not leak transaction IDs or amount. Use a VPN if you don't want to reveal your IP.
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium mb-2">Storage</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Transactions: {transactionCount}</div>
          <div>localStorage usage: {storageUsed} KB</div>
        </div>
      </div>

      {/* Price fetching */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium mb-2">Price Data (CryptoCompare)</h3>
        <p className="text-sm text-gray-500 mb-3">
          Fetch historical prices for all held assets at each transaction date.
          Free tier works without API key. Add a key for higher rate limits.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            CryptoCompare API Key (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={cryptoCompareApiKey}
              onChange={(e) => onSetCryptoCompareApiKey(e.target.value)}
              placeholder="API key..."
              className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {cryptoCompareApiKey && (
              <button
                onClick={() => onSetCryptoCompareApiKey("")}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {missingCount > 0 && !status.isFetching && (
          <p className="text-sm text-amber-600 mb-3">
            {missingCount} missing price{missingCount > 1 ? "s" : ""} detected.
          </p>
        )}

        {missingCount === 0 && !status.isFetching && (
          <p className="text-sm text-green-600 mb-3">
            All prices are cached.
          </p>
        )}

        {status.isFetching && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>
                Fetching... {status.progress.done} / {status.progress.total}
              </span>
              <span>
                {status.progress.total > 0
                  ? Math.round(
                      (status.progress.done / status.progress.total) * 100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: `${
                    status.progress.total > 0
                      ? (status.progress.done / status.progress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {status.errors.length > 0 && (
          <details className="mb-3">
            <summary className="text-sm text-red-600 cursor-pointer">
              {status.errors.length} price{status.errors.length > 1 ? "s" : ""} could
              not be fetched
            </summary>
            <ul className="mt-1 text-xs text-red-500 max-h-32 overflow-y-auto space-y-0.5">
              {status.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </details>
        )}

        {status.lastRun && !status.isFetching && (
          <p className="text-xs text-gray-400 mb-3">
            Last run: {status.lastRun.toLocaleTimeString("fr-FR")}
          </p>
        )}

        <div className="flex gap-2">
          {!status.isFetching ? (
            <button
              onClick={fetchMissingPrices}
              disabled={missingCount === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Fetch missing prices
            </button>
          ) : (
            <button
              onClick={abort}
              className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Export */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium mb-2">Export Data</h3>
        <p className="text-sm text-gray-500 mb-3">
          Download all your data as a JSON file. Includes transactions, cached
          prices, and settings.
        </p>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
        >
          Export JSON
        </button>
      </div>

      {/* Import */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium mb-2">Import Data</h3>
        <p className="text-sm text-gray-500 mb-3">
          Restore from a previously exported JSON file. This will replace all
          current data.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {importError && (
          <p className="text-sm text-red-600 mt-2">{importError}</p>
        )}
        {importSuccess && (
          <p className="text-sm text-green-600 mt-2">
            Data imported successfully!
          </p>
        )}
      </div>

      {/* Clear */}
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <h3 className="font-medium mb-2 text-red-700">Clear All Data</h3>
        <p className="text-sm text-gray-500 mb-3">
          Permanently delete all transactions, cached prices, and settings.
          This cannot be undone.
        </p>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
            >
              Yes, delete everything
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200"
          >
            Clear all data
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 border-t border-gray-200 pt-4">
        Walter is a personal tool for estimating crypto capital gains under
        French tax law (Article 150 VH bis CGI). It is not certified tax
        software and does not constitute tax advice. The 31.4% flat tax (PFU)
        rate is applied by default. Consult a qualified professional for your
        official tax return.
      </div>
    </div>
  );
}
