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

/**
 * A tradable instrument as returned by `GET /instruments`.
 *
 * NOTE (verified live): `symbol` is the raw KRX code (e.g. `41I1G8000`) while
 * `symbolType` is the familiar trading ticker (e.g. `VN30F1M`). Derivatives
 * have `marketId: "DVX"` and `securityGroupId: "FU"`.
 */
export interface Instrument {
  /** Raw KRX security code, e.g. `41I1G8000`. */
  symbol: string;
  /** Familiar ticker, e.g. `VN30F1M` — use this for price/OHLC & WS subscribe. */
  symbolType?: string;
  name?: string;
  shortName?: string;
  /** Market id, e.g. `DVX` for derivatives. */
  marketId?: string;
  /** Security group, e.g. `FU` (futures), `STO` (stock). */
  securityGroupId?: string;
  indexName?: string | null;
  listedDate?: string;
  [key: string]: unknown;
}

/** Response of `GET /instruments` — instruments are under `data`. */
export interface InstrumentsResponse {
  data?: Instrument[];
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
  /**
   * Turnover (giá trị giao dịch) per candle — computed client-side as
   * `v[i] * (h[i] + l[i] + c[i]) / 3` (volume × typical price). Not sent by
   * DNSE; added by `getOhlc`.
   */
  turnover?: number[];
  [key: string]: unknown;
}

/** Type passed as the first arg to `getOhlc` — selects the data set. */
export type OhlcMarket = MarketType | 'INDEX';
