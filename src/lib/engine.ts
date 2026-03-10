import type {
  Transaction,
  PortfolioSnapshot,
  SaleResult,
  AnnualTaxReport,
} from "../types";

const PFU_RATE = 0.314;

export interface PriceResolver {
  (date: string, holdings: Record<string, number>, currentTx: Transaction): Record<string, number>;
}

export interface EngineResult {
  snapshots: PortfolioSnapshot[];
  saleResults: SaleResult[];
  annualReports: AnnualTaxReport[];
  warnings: EngineWarning[];
}

export interface EngineWarning {
  transactionId: string;
  date: string;
  message: string;
  type: "missing_price" | "negative_holdings" | "zero_portfolio_value";
  assets?: string[];
}

export function computeTaxReport(
  transactions: Transaction[],
  resolvePrices: PriceResolver
): EngineResult {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let totalAcquisitionCost = 0;
  const holdings: Record<string, number> = {};
  const snapshots: PortfolioSnapshot[] = [];
  const saleResults: SaleResult[] = [];
  const warnings: EngineWarning[] = [];

  for (const tx of sorted) {
    if (tx.type === "buy") {
      processBuy(tx, holdings, totalAcquisitionCost);
      const asset = tx.asset!;
      const quantity = tx.quantity!;
      const totalEur = tx.totalEur!;

      holdings[asset] = (holdings[asset] ?? 0) + quantity;
      totalAcquisitionCost += totalEur + tx.fees;
    } else if (tx.type === "sell") {
      const result = processSell(
        tx,
        holdings,
        totalAcquisitionCost,
        resolvePrices,
        warnings
      );
      if (result) {
        saleResults.push(result.saleResult);
        totalAcquisitionCost = result.newAcquisitionCost;

        // Update holdings
        const asset = tx.asset!;
        const quantity = tx.quantity!;
        holdings[asset] = (holdings[asset] ?? 0) - quantity;
        if (holdings[asset] <= 1e-10) {
          delete holdings[asset];
        }
      }
    } else if (tx.type === "swap") {
      processSwap(tx, holdings, warnings);
    } else if (tx.type === "revenue") {
      // Staking/mining/lending revenue: adds to holdings but NOT acquisition cost
      const asset = tx.asset!;
      const quantity = tx.quantity ?? 0;
      if (asset && quantity > 0) {
        holdings[asset] = (holdings[asset] ?? 0) + quantity;
      }
    } else if (tx.type === "transfer") {
      // Transfers don't affect holdings or acquisition cost
    }

    // Record snapshot
    const snapshotPrices = resolvePrices(tx.date, { ...holdings }, tx);
    let portfolioValue = 0;
    for (const [asset, qty] of Object.entries(holdings)) {
      portfolioValue += qty * (snapshotPrices[asset] ?? 0);
    }

    snapshots.push({
      transactionId: tx.id,
      date: tx.date,
      totalAcquisitionCost,
      holdings: { ...holdings },
      globalPortfolioValue: portfolioValue,
      prices: { ...snapshotPrices },
    });
  }

  const annualReports = buildAnnualReports(saleResults);

  return { snapshots, saleResults, annualReports, warnings };
}

function processBuy(
  tx: Transaction,
  _holdings: Record<string, number>,
  _totalAcquisitionCost: number
): void {
  // Validation only; actual state changes happen in the main loop
  if (!tx.asset || !tx.quantity || tx.totalEur === undefined) {
    console.warn("Invalid buy transaction:", tx.id);
  }
}

function processSell(
  tx: Transaction,
  holdings: Record<string, number>,
  totalAcquisitionCost: number,
  resolvePrices: PriceResolver,
  warnings: EngineWarning[]
): { saleResult: SaleResult; newAcquisitionCost: number } | null {
  if (!tx.asset || !tx.quantity || tx.totalEur === undefined) {
    console.warn("Invalid sell transaction:", tx.id);
    return null;
  }

  const asset = tx.asset;
  const quantity = tx.quantity;

  // Check for negative holdings
  if ((holdings[asset] ?? 0) < quantity - 1e-10) {
    warnings.push({
      transactionId: tx.id,
      date: tx.date,
      message: `Selling ${quantity} ${asset} but only holding ${holdings[asset] ?? 0}`,
      type: "negative_holdings",
      assets: [asset],
    });
  }

  // Resolve prices for ALL held assets
  const prices = resolvePrices(tx.date, { ...holdings }, tx);

  // Check for missing prices
  const missingPrices = Object.keys(holdings).filter(
    (a) => holdings[a] > 0 && (prices[a] === undefined || prices[a] === null)
  );
  if (missingPrices.length > 0) {
    warnings.push({
      transactionId: tx.id,
      date: tx.date,
      message: `Missing prices for: ${missingPrices.join(", ")}`,
      type: "missing_price",
      assets: missingPrices,
    });
  }

  // Compute global portfolio value BEFORE the sale
  let globalPortfolioValue = 0;
  for (const [a, qty] of Object.entries(holdings)) {
    if (qty > 0) {
      globalPortfolioValue += qty * (prices[a] ?? 0);
    }
  }

  // Net sale price (fees deductible)
  const netSalePrice = tx.totalEur - tx.fees;

  let acquisitionFraction = 0;
  let profitOrLoss = 0;

  if (globalPortfolioValue > 0) {
    acquisitionFraction =
      totalAcquisitionCost * netSalePrice / globalPortfolioValue;
    profitOrLoss = netSalePrice - acquisitionFraction;
  } else {
    warnings.push({
      transactionId: tx.id,
      date: tx.date,
      message: "Global portfolio value is zero at time of sale",
      type: "zero_portfolio_value",
    });
    profitOrLoss = netSalePrice;
  }

  const newAcquisitionCost = Math.max(0, totalAcquisitionCost - acquisitionFraction);

  return {
    saleResult: {
      transactionId: tx.id,
      date: tx.date,
      asset,
      quantitySold: quantity,
      grossSalePrice: tx.totalEur,
      fees: tx.fees,
      netSalePrice,
      totalAcquisitionCostBefore: totalAcquisitionCost,
      globalPortfolioValueBefore: globalPortfolioValue,
      acquisitionFraction,
      profitOrLoss,
      totalAcquisitionCostAfter: newAcquisitionCost,
    },
    newAcquisitionCost,
  };
}

function processSwap(
  tx: Transaction,
  holdings: Record<string, number>,
  warnings: EngineWarning[]
): void {
  if (!tx.fromAsset || !tx.fromQuantity || !tx.toAsset || !tx.toQuantity) {
    console.warn("Invalid swap transaction:", tx.id);
    return;
  }

  // Check holdings
  if ((holdings[tx.fromAsset] ?? 0) < tx.fromQuantity - 1e-10) {
    warnings.push({
      transactionId: tx.id,
      date: tx.date,
      message: `Swapping ${tx.fromQuantity} ${tx.fromAsset} but only holding ${holdings[tx.fromAsset] ?? 0}`,
      type: "negative_holdings",
      assets: [tx.fromAsset],
    });
  }

  // Swap: remove fromAsset, add toAsset
  holdings[tx.fromAsset] = (holdings[tx.fromAsset] ?? 0) - tx.fromQuantity;
  if (holdings[tx.fromAsset] <= 1e-10) {
    delete holdings[tx.fromAsset];
  }
  holdings[tx.toAsset] = (holdings[tx.toAsset] ?? 0) + tx.toQuantity;

  // No change to totalAcquisitionCost
}

function buildAnnualReports(sales: SaleResult[]): AnnualTaxReport[] {
  const byYear = new Map<number, SaleResult[]>();

  for (const sale of sales) {
    const year = new Date(sale.date).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(sale);
  }

  const reports: AnnualTaxReport[] = [];
  for (const [year, yearSales] of byYear.entries()) {
    const totalGains = yearSales
      .filter((s) => s.profitOrLoss > 0)
      .reduce((sum, s) => sum + s.profitOrLoss, 0);
    const totalLosses = yearSales
      .filter((s) => s.profitOrLoss < 0)
      .reduce((sum, s) => sum + Math.abs(s.profitOrLoss), 0);
    const netResult = totalGains - totalLosses;

    reports.push({
      year,
      totalGains,
      totalLosses,
      netResult,
      taxDue: Math.max(0, netResult) * PFU_RATE,
      sales: yearSales,
    });
  }

  return reports.sort((a, b) => a.year - b.year);
}

export function computeTaxForYear(
  transactions: Transaction[],
  year: number,
  resolvePrices: PriceResolver
): { report: AnnualTaxReport | null; fullResult: EngineResult } {
  // Process ALL transactions up to Dec 31 of the target year
  const cutoff = new Date(year, 11, 31, 23, 59, 59, 999);
  const relevantTxs = transactions.filter(
    (tx) => new Date(tx.date).getTime() <= cutoff.getTime()
  );

  const fullResult = computeTaxReport(relevantTxs, resolvePrices);

  // Filter sale results to only the target year
  const yearSales = fullResult.saleResults.filter(
    (s) => new Date(s.date).getFullYear() === year
  );

  if (yearSales.length === 0) {
    return { report: null, fullResult };
  }

  const totalGains = yearSales
    .filter((s) => s.profitOrLoss > 0)
    .reduce((sum, s) => sum + s.profitOrLoss, 0);
  const totalLosses = yearSales
    .filter((s) => s.profitOrLoss < 0)
    .reduce((sum, s) => sum + Math.abs(s.profitOrLoss), 0);
  const netResult = totalGains - totalLosses;

  return {
    report: {
      year,
      totalGains,
      totalLosses,
      netResult,
      taxDue: Math.max(0, netResult) * PFU_RATE,
      sales: yearSales,
    },
    fullResult,
  };
}
