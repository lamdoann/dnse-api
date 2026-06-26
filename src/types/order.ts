import { MarketType, OrderSide, OrderType } from './shared';

/** Payload to place a new order. Mirrors the DNSE `POST /orders` body. */
export interface NewOrderParams {
  /** Sub-account placing the order. */
  accountNo: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  /** Limit price. Omit / ignore for market order types. */
  price?: number;
  quantity: number;
  /** Loan package to fund the order (from {@link getLoanPackages}). */
  loanPackageId?: number;
}

/** Payload to amend an existing order. */
export interface AmendOrderParams {
  price?: number;
  quantity?: number;
  [key: string]: unknown;
}

/** Payload to close (partially or fully) an open position. */
export interface ClosePositionParams {
  quantity?: number;
  price?: number;
  orderType?: OrderType;
  [key: string]: unknown;
}

/** A trading order in its current state. */
export interface Order {
  id: string;
  accountNo: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  marketType?: MarketType;
  price?: number;
  quantity: number;
  filledQuantity?: number;
  averagePrice?: number;
  orderStatus?: string;
  loanPackageId?: number;
  createdDate?: string;
  modifiedDate?: string;
  [key: string]: unknown;
}

export interface GetOrdersParams {
  marketType: MarketType;
}

export interface GetOrderDetailParams {
  marketType: MarketType;
}

/** One state-transition / partial-fill record for an order. */
export interface OrderExecutionDetail {
  orderId: string;
  status?: string;
  matchedQuantity?: number;
  matchedPrice?: number;
  time?: string;
  [key: string]: unknown;
}

export interface GetExecutionDetailParams {
  marketType: MarketType;
  /** Category filter (e.g. normal vs conditional orders). */
  orderCategory?: string;
}

export interface GetOrderHistoryParams {
  /** Inclusive start of the lookback window (max 1 year). */
  from?: string;
  to?: string;
  pageSize?: number;
  pageIndex?: number;
}

export interface OrderHistoryResponse {
  orders: Order[];
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  [key: string]: unknown;
}
