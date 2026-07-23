import { MarketType, OhlcResolution } from './shared';

export interface GetSecurityDefinitionParams {
  /** Trading board id (e.g. `MAIN`, `WATCHLIST`). */
  boardId?: string;
}

/** Filters for listing tradable instruments (`GET /instruments`). */
export interface GetInstrumentsParams {
  symbol?: string;
  /** Market id filter. */
  marketId?: string;
  /**
   * Security group id filter — distinguishes stock / futures / etf / etc.
   * The exact code for derivatives is not in the public SDK; filter
   * client-side if unsure (see the `derivatives-realtime` example).
   */
  securityGroupId?: string;
  indexName?: string;
  limit?: number;
  page?: number;
}

/** A tradable instrument as returned by `GET /instruments`. */
export interface Instrument {
  symbol: string;
  name?: string;
  marketId?: string;
  securityGroupId?: string;
  securityType?: string;
  exchange?: string;
  [key: string]: unknown;
}

/** Response of `GET /instruments` (array, possibly wrapped + paginated). */
export interface InstrumentsResponse {
  instruments?: Instrument[];
  total?: number;
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

/** Reference / definition data for a security. */
export interface SecurityDefinition {
  symbol: string;
  boardId?: string;
  exchange?: string;
  securityType?: string;
  ceiling?: number;
  floor?: number;
  reference?: number;
  lotSize?: number;
  [key: string]: unknown;
}

export interface GetOhlcParams {
  symbol: string;
  resolution: OhlcResolution;
  /** Unix timestamp (seconds), inclusive. */
  from: number;
  /** Unix timestamp (seconds), inclusive. */
  to: number;
}

/**
 * OHLC response. DNSE returns TradingView-style parallel arrays keyed by
 * `t` (time), `o`, `h`, `l`, `c` (close) and `v` (volume).
 */
export interface OhlcResponse {
  /** `ok` when data is present, `no_data` otherwise. */
  s?: string;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  [key: string]: unknown;
}

/** Type passed as the first arg to `getOhlc` — selects the data set. */
export type OhlcMarket = MarketType | 'INDEX';
