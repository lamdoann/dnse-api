import { MarketType, OhlcResolution } from './shared';

export interface GetSecurityDefinitionParams {
  /** Trading board id (e.g. `MAIN`, `WATCHLIST`). */
  boardId?: string;
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
