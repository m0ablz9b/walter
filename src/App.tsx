import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAppState } from "./hooks/useAppState";
import { useEngine } from "./hooks/useEngine";
import { usePriceFetcher } from "./hooks/usePriceFetcher";
import Layout from "./components/Layout";
import TransactionsPage from "./pages/TransactionsPage";
import PortfolioPage from "./pages/PortfolioPage";
import TaxReportPage from "./pages/TaxReportPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const {
    state,
    addTransactions,
    deleteTransaction,
    updateTransaction,
    updatePriceCache,
    setCryptoCompareApiKey,
    clearAll,
    importState,
  } = useAppState();

  const engineResult = useEngine(state);
  const priceFetcher = usePriceFetcher(state, updatePriceCache);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <TransactionsPage
                transactions={state.transactions}
                onImport={addTransactions}
                onDelete={deleteTransaction}
                onUpdate={updateTransaction}
              />
            }
          />
          <Route
            path="portfolio"
            element={
              <PortfolioPage
                engineResult={engineResult}
                priceFetcher={priceFetcher}
              />
            }
          />
          <Route
            path="tax"
            element={<TaxReportPage state={state} />}
          />
          <Route
            path="settings"
            element={
              <SettingsPage
                onClearAll={clearAll}
                onImportState={importState}
                transactionCount={state.transactions.length}
                priceFetcher={priceFetcher}
                cryptoCompareApiKey={state.cryptoCompareApiKey ?? ""}
                onSetCryptoCompareApiKey={setCryptoCompareApiKey}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
