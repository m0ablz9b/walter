export interface Transaction {
  id: string;
  date: string; // ISO 8601
  type: "buy" | "sell" | "swap" | "transfer" | "revenue";
  // For buy/sell
  asset?: string;
  quantity?: number;
  pricePerUnit?: number; // EUR
  totalEur?: number;
  // For swap
  fromAsset?: string;
  fromQuantity?: number;
  toAsset?: string;
  toQuantity?: number;
  // Common
  fees: number; // EUR
  exchange: string;
  notes: string;
  txId?: string; // on-chain or exchange transaction ID
  transactionProof?: string; // document path or URL
}

export interface PortfolioSnapshot {
  transactionId: string;
  date: string;
  totalAcquisitionCost: number;
  holdings: Record<string, number>; // asset symbol -> quantity
  globalPortfolioValue: number;
  prices: Record<string, number>; // asset symbol -> EUR price per unit
}

export interface SaleResult {
  transactionId: string;
  date: string;
  asset: string;
  quantitySold: number;
  grossSalePrice: number;
  fees: number;
  netSalePrice: number;
  totalAcquisitionCostBefore: number;
  globalPortfolioValueBefore: number;
  acquisitionFraction: number;
  profitOrLoss: number;
  totalAcquisitionCostAfter: number;
}

export interface AnnualTaxReport {
  year: number;
  totalGains: number;
  totalLosses: number;
  netResult: number;
  taxDue: number; // 30% PFU
  sales: SaleResult[];
}

export interface PriceCache {
  // "YYYY-MM-DD:SYMBOL" -> EUR price
  [key: string]: number;
}

export interface AppState {
  transactions: Transaction[];
  priceCache: PriceCache;
  manualPrices: PriceCache; // user-entered overrides
  cryptoCompareApiKey?: string;
}
