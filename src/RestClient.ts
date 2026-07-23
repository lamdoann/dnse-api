import {
  AccountBalance,
  AccountsResponse,
  AmendOrderParams,
  ClosePositionParams,
  CorporateActionEvent,
  CreateTradingTokenParams,
  DryRunResult,
  GetCorporateActionHistoryParams,
  GetExecutionDetailParams,
  GetLoanPackagesParams,
  GetOhlcParams,
  GetOrderDetailParams,
  GetOrderHistoryParams,
  GetPositionsParams,
  GetPpseParams,
  GetSecurityDefinitionParams,
  LoanPackage,
  MarketType,
  NewOrderParams,
  OhlcMarket,
  OhlcResponse,
  Order,
  OrderExecutionDetail,
  OrderHistoryResponse,
  Position,
  PpseResponse,
  RequestOptions,
  SecurityDefinition,
  SendEmailOtpParams,
  TradingTokenResponse,
} from './types';
import { BaseRestClient } from './util/BaseRestClient';
import { fillPathParams } from './util/requestUtils';

/**
 * Main DNSE OpenAPI REST client.
 *
 * @example
 * ```ts
 * const client = new RestClient({ apiKey: '...', apiSecret: '...' });
 * const { accounts } = await client.getAccounts();
 * ```
 */
export class RestClient extends BaseRestClient {
  // ===================================================================
  // Authentication / trading token
  // ===================================================================

  /** Trigger an email OTP, the first step of minting a trading token. */
  sendEmailOtp(params: SendEmailOtpParams, options?: RequestOptions) {
    return this.postPrivate<void | DryRunResult>(
      '/registration/send-email-otp',
      { otpType: 'email', ...params },
      options,
    );
  }

  /**
   * Exchange a one-time passcode (email or Smart OTP) for a short-lived
   * `tradingToken`. Pass the returned token via `options.tradingToken` on all
   * order-mutating calls.
   */
  createTradingToken(params: CreateTradingTokenParams, options?: RequestOptions) {
    return this.postPrivate<TradingTokenResponse | DryRunResult>(
      '/registration/trading-token',
      { ...params },
      options,
    );
  }

  // ===================================================================
  // Account information
  // ===================================================================

  /** List the investor's trading sub-accounts. */
  getAccounts(options?: RequestOptions) {
    return this.getPrivate<AccountsResponse | DryRunResult>('/accounts', undefined, options);
  }

  /** Cash & asset balances for a sub-account. */
  getBalances(accountNo: string, options?: RequestOptions) {
    return this.getPrivate<AccountBalance | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/balances', { accountNo }),
      undefined,
      options,
    );
  }

  /** Loan packages usable for orders on a sub-account (optionally per symbol). */
  getLoanPackages(
    accountNo: string,
    params?: GetLoanPackagesParams,
    options?: RequestOptions,
  ) {
    return this.getPrivate<LoanPackage[] | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/loan-packages', { accountNo }),
      params ? { ...params } : undefined,
      options,
    );
  }

  /** Purchasing / selling power for a symbol under a loan package. */
  getPpse(accountNo: string, params: GetPpseParams, options?: RequestOptions) {
    return this.getPrivate<PpseResponse | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/ppse', { accountNo }),
      { ...params },
      options,
    );
  }

  /** Corporate-action event history for the account. */
  getCorporateActionHistory(
    accountNo: string,
    params?: GetCorporateActionHistoryParams,
    options?: RequestOptions,
  ) {
    return this.getPrivate<CorporateActionEvent[] | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/corporate-action-history', { accountNo }),
      params ? { ...params } : undefined,
      options,
    );
  }

  // ===================================================================
  // Positions
  // ===================================================================

  /** Held positions (stock holdings or open derivative positions). */
  getPositions(accountNo: string, params: GetPositionsParams, options?: RequestOptions) {
    return this.getPrivate<Position[] | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/positions', { accountNo }),
      { ...params },
      options,
    );
  }

  // ===================================================================
  // Orders — read
  // ===================================================================

  /** Today's order book for a sub-account in a given market. */
  getOrders(accountNo: string, marketType: MarketType, options?: RequestOptions) {
    return this.getPrivate<Order[] | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/orders', { accountNo }),
      { marketType },
      options,
    );
  }

  /** Detail for a single order. */
  getOrderDetail(
    accountNo: string,
    orderId: string,
    params: GetOrderDetailParams,
    options?: RequestOptions,
  ) {
    return this.getPrivate<Order | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/orders/{orderId}', {
        accountNo,
        orderId,
      }),
      { ...params },
      options,
    );
  }

  /** State-transition / partial-fill history for an order. */
  getExecutionDetail(
    accountNo: string,
    orderId: string,
    params: GetExecutionDetailParams,
    options?: RequestOptions,
  ) {
    return this.getPrivate<OrderExecutionDetail[] | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/executions/{orderId}', {
        accountNo,
        orderId,
      }),
      { ...params },
      options,
    );
  }

  /** Historical orders within a window (max 1-year lookback). */
  getOrderHistory(
    accountNo: string,
    params?: GetOrderHistoryParams,
    options?: RequestOptions,
  ) {
    return this.getPrivate<OrderHistoryResponse | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/orders/history', { accountNo }),
      params ? { ...params } : undefined,
      options,
    );
  }

  // ===================================================================
  // Orders — write (require a trading token)
  // ===================================================================

  /**
   * Place a new order. Requires a `tradingToken` in `options`.
   * @param marketType `STOCK` or `DERIVATIVE`.
   */
  placeOrder(
    marketType: MarketType,
    params: NewOrderParams,
    options: RequestOptions & { tradingToken: string },
  ) {
    return this.postPrivate<Order | DryRunResult>(
      `/accounts/orders?marketType=${encodeURIComponent(marketType)}`,
      { ...params },
      options,
    );
  }

  /** Amend price / quantity of a working order. Requires a trading token. */
  amendOrder(
    accountNo: string,
    orderId: string,
    marketType: MarketType,
    params: AmendOrderParams,
    options: RequestOptions & { tradingToken: string },
  ) {
    return this.putPrivate<Order | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/orders/{orderId}?marketType={marketType}', {
        accountNo,
        orderId,
        marketType,
      }),
      { ...params },
      options,
    );
  }

  /** Cancel a working order. Requires a trading token. */
  cancelOrder(
    accountNo: string,
    orderId: string,
    marketType: MarketType,
    options: RequestOptions & { tradingToken: string },
  ) {
    return this.deletePrivate<Order | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/orders/{orderId}', {
        accountNo,
        orderId,
      }),
      { marketType },
      options,
    );
  }

  /** Close (fully or partially) an open position. Requires a trading token. */
  closePosition(
    accountNo: string,
    positionId: string,
    marketType: MarketType,
    params: ClosePositionParams,
    options: RequestOptions & { tradingToken: string },
  ) {
    return this.postPrivate<Order | DryRunResult>(
      fillPathParams('/accounts/{accountNo}/positions/{positionId}/close?marketType={marketType}', {
        accountNo,
        positionId,
        marketType,
      }),
      { ...params },
      options,
    );
  }

  // ===================================================================
  // Market data
  // ===================================================================

  /**
   * Security definition (board, ceiling/floor, lot size, ...).
   * Requires API key/secret — the OpenAPI gateway signs all requests.
   */
  getSecurityDefinition(
    symbol: string,
    params?: GetSecurityDefinitionParams,
    options?: RequestOptions,
  ) {
    return this.getPrivate<SecurityDefinition | DryRunResult>(
      fillPathParams('/price/{symbol}/secdef', { symbol }),
      params ? { ...params } : undefined,
      options,
    );
  }

  /**
   * OHLC candles (TradingView-style parallel arrays).
   * Requires API key/secret — the OpenAPI gateway signs all requests.
   * @param market `STOCK`, `DERIVATIVE` or `INDEX`.
   */
  getOhlc(market: OhlcMarket, params: GetOhlcParams, options?: RequestOptions) {
    return this.getPrivate<OhlcResponse | DryRunResult>(
      '/price/ohlc',
      { type: market, ...params },
      options,
    );
  }
}
