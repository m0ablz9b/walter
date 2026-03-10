import { useState } from "react";
import type { SaleResult } from "../types";
import { formatDate, formatEur, formatQty } from "../lib/format";

interface Props {
  sale: SaleResult;
}

export default function SaleDetail({ sale }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">{formatDate(sale.date)}</span>
          <span className="font-medium">
            Sold {formatQty(sale.quantitySold, sale.asset)}{" "}
            {sale.asset}
          </span>
          <span className="text-gray-600">
            for {formatEur(sale.grossSalePrice)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`font-semibold ${
              sale.profitOrLoss >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {sale.profitOrLoss >= 0 ? "+" : ""}
            {formatEur(sale.profitOrLoss)}
          </span>
          <span className="text-gray-400 text-xs">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm space-y-2">
          <h4 className="font-medium text-gray-700 mb-2">
            Calculation breakdown (Article 150 VH bis CGI)
          </h4>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <span className="text-gray-500">Gross sale price:</span>
            <span className="text-right tabular-nums">
              {formatEur(sale.grossSalePrice)}
            </span>

            <span className="text-gray-500">Fees deducted:</span>
            <span className="text-right tabular-nums">
              - {formatEur(sale.fees)}
            </span>

            <span className="text-gray-500 font-medium">
              Net sale price (Prix de cession):
            </span>
            <span className="text-right tabular-nums font-medium">
              {formatEur(sale.netSalePrice)}
            </span>

            <div className="col-span-2 border-t border-gray-200 my-1"></div>

            <span className="text-gray-500">
              Total acquisition cost before sale:
            </span>
            <span className="text-right tabular-nums">
              {formatEur(sale.totalAcquisitionCostBefore)}
            </span>

            <span className="text-gray-500">
              Global portfolio value at sale:
            </span>
            <span className="text-right tabular-nums">
              {formatEur(sale.globalPortfolioValueBefore)}
            </span>

            <div className="col-span-2 border-t border-gray-200 my-1"></div>

            <span className="text-gray-500">
              Acquisition fraction consumed:
            </span>
            <span className="text-right tabular-nums">
              {formatEur(sale.acquisitionFraction)}
            </span>

            <div className="col-span-2 text-xs text-gray-400 italic">
              = {formatEur(sale.totalAcquisitionCostBefore)} ×{" "}
              {formatEur(sale.netSalePrice)} /{" "}
              {formatEur(sale.globalPortfolioValueBefore)}
            </div>

            <div className="col-span-2 border-t border-gray-200 my-1"></div>

            <span className="font-medium text-gray-700">
              Plus/Moins-value:
            </span>
            <span
              className={`text-right tabular-nums font-semibold ${
                sale.profitOrLoss >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {sale.profitOrLoss >= 0 ? "+" : ""}
              {formatEur(sale.profitOrLoss)}
            </span>

            <div className="col-span-2 text-xs text-gray-400 italic">
              = {formatEur(sale.netSalePrice)} -{" "}
              {formatEur(sale.acquisitionFraction)}
            </div>

            <div className="col-span-2 border-t border-gray-200 my-1"></div>

            <span className="text-gray-500">
              Acquisition cost after sale:
            </span>
            <span className="text-right tabular-nums">
              {formatEur(sale.totalAcquisitionCostAfter)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
