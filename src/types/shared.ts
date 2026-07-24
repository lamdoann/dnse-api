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
 * Candle resolution for OHLC (REST + WS). Verified live: `'60'`, `'D'` and
 * `'1M'` return no data — use `'1H'` for hourly and `'1D'`/`'1W'` for
 * day/week.
 */
export type OhlcResolution = '1' | '3' | '5' | '15' | '30' | '1H' | '1D' | '1W';
