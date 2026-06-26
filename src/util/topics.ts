/**
 * MQTT topic builders for the DNSE KRX market-data feed.
 *
 * ⚠️ VERIFY: the exact KRX topic path segments are documented on the DNSE
 * LightSpeed docs (GitBook, JS-rendered) and could not be machine-verified
 * here. The patterns below follow the published `plaintext/quotes/...`
 * convention. If a subscription returns nothing, cross-check the live spec at:
 *   https://hdsd.dnse.com.vn/san-pham-dich-vu/lightspeed-api_krx
 * and adjust these builders — they are the single source of truth for topics.
 *
 * The {@link MarketDataWsClient} also accepts raw topic strings via
 * `subscribe()`, so you are never blocked on these helpers being exact.
 */

const ROOT = 'plaintext/quotes';

/** Stock info — last matched price, volume, change. (`SI`) */
export function stockInfoTopic(symbol: string): string {
  return `${ROOT}/stock/SI/${symbol}`;
}

/** Top price — bid/ask order book levels. (`TP`) */
export function topPriceTopic(symbol: string): string {
  return `${ROOT}/stock/TP/${symbol}`;
}

/** Tick — individual matched trades. */
export function tickTopic(symbol: string): string {
  return `${ROOT}/stock/TICK/${symbol}`;
}

/** Market index value (e.g. `VNINDEX`, `HNXINDEX`, `VN30`). */
export function marketIndexTopic(indexCode: string): string {
  return `${ROOT}/index/${indexCode}`;
}

/**
 * OHLC candles streamed for a symbol at a resolution
 * (`1`, `5`, `15`, `30`, `60`, `D`, ...).
 */
export function ohlcTopic(symbol: string, resolution: string): string {
  return `${ROOT}/stock/OHLC/${resolution}/${symbol}`;
}

/** Board / session event (open, intermission, close, ...). */
export function boardEventTopic(boardId = 'ALL'): string {
  return `${ROOT}/board-event/${boardId}`;
}

/** Convenience map of the common topic families. */
export const Topics = {
  stockInfo: stockInfoTopic,
  topPrice: topPriceTopic,
  tick: tickTopic,
  marketIndex: marketIndexTopic,
  ohlc: ohlcTopic,
  boardEvent: boardEventTopic,
};
