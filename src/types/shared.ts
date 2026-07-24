/**
 * Shared enums / primitive unions used across the DNSE OpenAPI.
 *
 * The values mirror those used by the official DNSE OpenAPI SDK examples.
 */

/** Market a request targets. */
export type MarketType = 'STOCK' | 'DERIVATIVE';

/** Order side. */
export type OrderSide = 'BUY' | 'SELL';

/**
 * Order type / matching method.
 * - `LO`  Limit order
 * - `MP`  Market order
 * - `ATO` At-the-open
 * - `ATC` At-the-close
 * - `MOK` Match-or-kill
 * - `MAK` Match-and-kill
 * - `PLO` Post-session limit order
 */
export type OrderType = 'LO' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO';

/** OTP delivery / verification channel used when minting a trading token. */
export type OtpType = 'email' | 'smart';

/**
 * Candle resolution for OHLC queries. Minutes as `'1'..'60'`, and day/week/
 * month as `'1D'`/`'1W'`/`'1M'` (verified live — plain `'D'` returns no data).
 */
export type OhlcResolution =
  | '1'
  | '3'
  | '5'
  | '15'
  | '30'
  | '60'
  | '1D'
  | '1W'
  | '1M';
