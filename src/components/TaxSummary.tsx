import type { AnnualTaxReport } from "../types";
import SaleDetail from "./SaleDetail";

interface Props {
  report: AnnualTaxReport;
}

function formatEur(value: number): string {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TaxSummary({ report }: Props) {
  const totalSalesValue = report.sales.reduce((sum, s) => sum + s.grossSalePrice, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Sales</div>
          <div className="text-xl font-semibold mt-1 text-gray-900">
            {formatEur(totalSalesValue)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {report.sales.length} transaction{report.sales.length > 1 ? "s" : ""}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Gains</div>
          <div className="text-xl font-semibold mt-1 text-green-600">
            +{formatEur(report.totalGains)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Losses</div>
          <div className="text-xl font-semibold mt-1 text-red-600">
            -{formatEur(report.totalLosses)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Net Result</div>
          <div
            className={`text-xl font-semibold mt-1 ${
              report.netResult >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {report.netResult >= 0 ? "+" : ""}
            {formatEur(report.netResult)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Tax Due (31.4% PFU)</div>
          <div className="text-xl font-semibold mt-1 text-gray-900">
            {formatEur(report.taxDue)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">
          Sales detail ({report.sales.length} transactions)
        </h3>
        <div className="space-y-2">
          {report.sales.map((sale) => (
            <SaleDetail key={sale.transactionId} sale={sale} />
          ))}
        </div>
      </div>
    </div>
  );
}
