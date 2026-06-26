import { MarketType } from './shared';

/** A trading sub-account belonging to the authenticated investor. */
export interface TradingAccount {
  accountNo: string;
  investorId?: string;
  name?: string;
  custodyCode?: string;
  /** Whether this sub-account trades derivatives. */
  derivativeAccount?: boolean;
  [key: string]: unknown;
}

export interface AccountsResponse {
  /** Investor-level identifier. */
  investorId?: string;
  accounts: TradingAccount[];
  [key: string]: unknown;
}

/** Cash / asset balances for a single sub-account. */
export interface AccountBalance {
  accountNo: string;
  /** Total net asset value. */
  netAssetValue?: number;
  totalCash?: number;
  availableCash?: number;
  /** Cash that can be withdrawn. */
  withdrawableCash?: number;
  /** Stock market value at the latest price. */
  stockValue?: number;
  /** Outstanding margin / loan debt. */
  totalDebt?: number;
  /** Purchasing power for new orders. */
  purchasingPower?: number;
  marginRatio?: number;
  [key: string]: unknown;
}

/** A loan package usable when placing margin orders for a given symbol. */
export interface LoanPackage {
  id: number;
  name?: string;
  type?: string;
  initialRate?: number;
  maintenanceRate?: number;
  interestRate?: number;
  loanTerm?: number;
  [key: string]: unknown;
}

export interface GetLoanPackagesParams {
  /** Filter packages applicable to this security symbol. */
  symbol?: string;
}

/** Purchasing / selling power for a symbol under a loan package. */
export interface PpseResponse {
  symbol: string;
  /** Purchasing power (max buy quantity / value). */
  ppse?: number;
  qmax?: number;
  marginRatio?: number;
  price?: number;
  loanPackageId?: number;
  [key: string]: unknown;
}

export interface GetPpseParams {
  marketType: MarketType;
  symbol: string;
  price: number;
  loanPackageId: number;
}

/** A held position (stock holding or derivative open position). */
export interface Position {
  positionId?: string;
  symbol: string;
  marketType?: MarketType;
  quantity?: number;
  availableQuantity?: number;
  costPrice?: number;
  marketPrice?: number;
  unrealizedProfit?: number;
  [key: string]: unknown;
}

export interface GetPositionsParams {
  marketType: MarketType;
}

/** Take-profit / stop-loss configuration attached to a position. */
export interface PositionProfitLossConfig {
  positionId: string;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

/** A single corporate-action event affecting the account. */
export interface CorporateActionEvent {
  symbol: string;
  eventType?: string;
  recordDate?: string;
  exDate?: string;
  ratio?: string;
  cashPerShare?: number;
  [key: string]: unknown;
}

export interface GetCorporateActionHistoryParams {
  fromDate?: string;
  toDate?: string;
}
