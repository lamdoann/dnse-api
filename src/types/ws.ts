import { DefaultLogger } from '../util/logger';
import { MarketType, OhlcResolution } from './shared';

/**
 * Options for the OpenAPI realtime market-data WebSocket client.
 *
 * Uses the SAME `apiKey` / `apiSecret` as {@link RestClient} — the realtime
 * feed authenticates with an HMAC handshake, not a separate login/JWT.
 */
export interface MarketDataWsOptions {
  /** API key (same as REST). */
  apiKey: string;
  /** API secret (same as REST) — signs the auth handshake. */
  apiSecret: string;

  /**
   * Base WebSocket URL (no path). The client appends `/v1/stream?encoding=...`.
   * @default 'wss://ws-openapi.dnse.com.vn'
   */
  baseUrl?: string;

  /** Delay between reconnect attempts in ms. Set 0 to disable. @default 3000 */
  reconnectPeriod?: number;
  /** Max reconnect attempts before giving up. @default 10 */
  maxReconnectAttempts?: number;
  /** Ping interval in ms to keep the connection alive. @default 25000 */
  pingInterval?: number;

  /** Inject a custom logger. */
  logger?: DefaultLogger;
}

/** Boards used by symbol-scoped channels (trades, quotes, security_definition). */
export const DEFAULT_BOARDS = [
  'G1',
  'G3',
  'G4',
  'G7',
  'T1',
  'T2',
  'T3',
  'T4',
  'T6',
] as const;

/** A subscribable channel descriptor sent to the server. */
export interface ChannelSpec {
  /** Channel name, e.g. `ohlc.1.json`, `tick.G1.json`, `market_index.VNINDEX.json`. */
  name: string;
  /** Symbols to scope the channel to (omit for board/index-wide channels). */
  symbols?: string[];
}

/**
 * Message type discriminator carried in the `T` field of every data frame,
 * mapped to a friendly event name.
 */
export const WS_MESSAGE_TYPES: Record<string, string> = {
  t: 'trade',
  te: 'trade_extra',
  e: 'expected_price',
  q: 'quote',
  b: 'ohlc',
  bc: 'ohlc_closed',
  sd: 'security_definition',
  mi: 'market_index',
  emi: 'estimated_market_index',
  a: 'account',
  f: 'foreign',
  s: 'session',
  do: 'order_event',
  eo: 'order_event',
  dp: 'position_event',
  ep: 'position_event',
};

// ===================================================================
// Typed message payloads
//
// Fields for `ohlc`, `quote`, `trade`, `market_index` are typed from LIVE
// wire captures. The rest follow the official Python SDK models and are marked
// ⚠️ (chưa verify wire). Every payload keeps an index signature so extra /
// unknown fields never break typing and stay forward-compatible.
// ===================================================================

/** Wire timestamp used by several message types: seconds + nanoseconds. */
export interface WsTimestamp {
  Seconds: number;
  Nanos: number;
}

/** One order-book level. */
export interface PriceLevel {
  price: number;
  qtty: number;
}

interface WsPayloadBase {
  /** Raw type discriminator echoed in the frame. */
  T?: string;
  [key: string]: unknown;
}

/** `ohlc` (T=`b`) / `ohlc_closed` (T=`bc`) — verified live. */
export interface OhlcData extends WsPayloadBase {
  symbol: string;
  resolution: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Candle open time — epoch seconds (a plain number for ohlc). */
  time: number;
  lastUpdated?: number;
  /** Market type, e.g. `DERIVATIVE`. */
  type?: string;
}

/** `quote` (T=`q`) — top-of-book bid/offer. Verified live. */
export interface QuoteData extends WsPayloadBase {
  symbol: string;
  marketId: string;
  boardId: string;
  isin?: string;
  bid: PriceLevel[];
  offer: PriceLevel[];
  totalBidQtty?: number;
  totalOfferQtty?: number;
  time?: WsTimestamp;
  multicastReceiveTime?: WsTimestamp;
}

/** `trade` (T=`t`) — matched tick. Verified live. */
export interface TradeData extends WsPayloadBase {
  symbol: string;
  marketId: string;
  boardId: string;
  isin?: string;
  matchPrice: number;
  matchQtty: number;
  totalVolumeTraded: number;
  grossTradeAmount: number;
  openPrice: number;
  highestPrice: number;
  lowestPrice: number;
  tradingSessionId?: string;
  time?: WsTimestamp;
  multicastReceiveTime?: WsTimestamp;
}

/** `market_index` (T=`mi`). Verified live. */
export interface MarketIndexData extends WsPayloadBase {
  indexName: string;
  valueIndexes: number;
  changedValue: number;
  changedRatio: number;
  priorValueIndexes?: number;
  highestValueIndexes?: number;
  lowestValueIndexes?: number;
  totalVolumeTraded?: number;
  grossTradeAmount?: number;
  marketId?: string;
  marketIndexClass?: string;
  indexTypeCode?: string;
  currencyCode?: string;
  tradingSessionId?: string;
  transactTime?: WsTimestamp;
  multicastReceiveTime?: WsTimestamp;
}

/**
 * `trade_extra` (T=`te`) — tick kèm giá bình quân. Verified live: dùng
 * `matchPrice`/`matchQtty` giống `trade` (KHÔNG phải `price`/`quantity`).
 */
export interface TradeExtraData extends WsPayloadBase {
  symbol: string;
  marketId?: string;
  boardId?: string;
  isin?: string;
  matchPrice: number;
  matchQtty: number;
  /** Giá bình quân lũy kế trong phiên. */
  avgPrice?: number;
  /** Giá trị giao dịch lũy kế — đơn vị tỷ VND. */
  grossTradeAmount?: number;
  totalVolumeTraded?: number;
  openPrice?: number;
  highestPrice?: number;
  lowestPrice?: number;
  /** Bên chủ động khớp. */
  side?: number;
  tradingSessionId?: string;
  time?: WsTimestamp;
  multicastReceiveTime?: WsTimestamp;
}

/** `expected_price` (T=`e`) — giá dự kiến khớp. ⚠️ chưa verify wire. */
export interface ExpectedPriceData extends WsPayloadBase {
  symbol: string;
  marketId?: string;
  boardId?: string;
  isin?: string;
  closePrice?: number;
  expectedTradePrice?: number;
  expectedTradeQuantity?: number;
  time?: WsTimestamp;
}

/** `estimated_market_index` (T=`emi`) — chỉ số ước tính. ⚠️ chưa verify wire. */
export interface EstimatedMarketIndexData extends WsPayloadBase {
  indexName: string;
  valueIndexes?: number;
  changedValue?: number;
  changedRatio?: number;
  totalVolumeTraded?: number;
  grossTradeAmount?: number;
  fluctuationUpIssueCount?: number;
  fluctuationDownIssueCount?: number;
  fluctuationSteadinessIssueCount?: number;
  time?: WsTimestamp;
}

/** `foreign` (T=`f`) — giao dịch khối ngoại. ⚠️ chưa verify wire. */
export interface ForeignInvestorData extends WsPayloadBase {
  symbol: string;
  marketId?: string;
  boardId?: string;
  tradingSessionId?: string;
  foreignInvestorTypeCode?: string;
  buyVolume?: number;
  buyTradedAmount?: number;
  sellVolume?: number;
  sellTradedAmount?: number;
  totalBuyVolume?: number;
  totalBuyTradedAmount?: number;
  totalSellVolume?: number;
  totalSellTradedAmount?: number;
  /** Room ngoại còn lại. */
  foreignerBuyPossibleQuantity?: number;
  foreignerOrderLimitQuantity?: number;
  transactTime?: WsTimestamp;
}

/** `session` (T=`s`) — trạng thái/sự kiện phiên. ⚠️ chưa verify wire. */
export interface SessionData extends WsPayloadBase {
  marketId?: string;
  boardId?: string;
  /** Mã sự kiện phiên. */
  eventId?: string;
  /** Mã phiên hiện tại (vd `40` = khớp lệnh liên tục). */
  tradingSessionId?: number | string;
  /** Product group id. */
  tscProdGrpId?: string;
  time?: WsTimestamp;
}

/** `security_definition` (T=`sd`). ⚠️ theo SDK models — chưa verify wire. */
export interface SecurityDefinitionMessage extends WsPayloadBase {
  symbol: string;
  marketId?: string;
  boardId?: string;
  isin?: string;
  securityGroupId?: string;
  basicPrice?: number;
  ceilingPrice?: number;
  floorPrice?: number;
  openInterestQuantity?: number;
  securityStatus?: string;
}

/** `order_event` (T=`do`/`eo`). ⚠️ theo SDK models — chưa verify wire. */
export interface OrderEventData extends WsPayloadBase {
  id: string;
  accountNo: string;
  symbol: string;
  side: string;
  price: number;
  averagePrice?: number;
  quantity: number;
  fillQuantity?: number;
  leaveQuantity?: number;
  canceledQuantity?: number;
  orderType: string;
  orderStatus: string;
  loanPackageId?: number;
  marketType?: string;
  createdDate?: string;
  modifiedDate?: string;
}

/** `position_event` (T=`dp`/`ep`). ⚠️ theo SDK models — chưa verify wire. */
export interface PositionEventData extends WsPayloadBase {
  id: number;
  accountNo: string;
  symbol: string;
  side: string;
  status?: string;
  costPrice?: number;
  marketPrice?: number;
  breakEvenPrice?: number;
  openQuantity?: number;
  accumulateQuantity?: number;
  closedQuantity?: number;
  marketType?: string;
}

/** `account` (T=`a`). ⚠️ theo SDK models — chưa verify wire. */
export interface AccountUpdateData extends WsPayloadBase {
  cash?: number;
  buyingPower?: number;
  portfolioValue?: number;
  equity?: number;
}

/** A decoded realtime data frame. `T` is narrowed per event (see events). */
export interface MarketDataMessage<T = Record<string, unknown>> {
  /** Friendly event name (e.g. `ohlc`, `quote`, `trade`). */
  type: string;
  /** Raw `T` discriminator from the wire. */
  rawType: string;
  /** The decoded payload. */
  data: T;
}

export interface SubscribeOhlcParams {
  symbols: string[];
  resolution: OhlcResolution;
}

/** Market type accepted by order/position event subscriptions. */
export type WsMarketType = MarketType;

/** Event map emitted by {@link WebsocketClient}. */
export interface MarketDataWsEvents {
  /** Connected & authenticated (auth_success received). */
  open: () => void;
  /** Connection closed. */
  close: () => void;
  /** A reconnect attempt is starting. */
  reconnect: () => void;
  /** Re-authenticated & re-subscribed after a drop. */
  reconnected: () => void;
  /** Transport / protocol / auth error. */
  error: (err: Error) => void;
  /** Any decoded data frame (payload untyped — use per-type events for schema). */
  message: (msg: MarketDataMessage) => void;
  // Market-data per-type events — payloads typed.
  ohlc: (msg: MarketDataMessage<OhlcData>) => void;
  ohlc_closed: (msg: MarketDataMessage<OhlcData>) => void;
  quote: (msg: MarketDataMessage<QuoteData>) => void;
  trade: (msg: MarketDataMessage<TradeData>) => void;
  security_definition: (msg: MarketDataMessage<SecurityDefinitionMessage>) => void;
  market_index: (msg: MarketDataMessage<MarketIndexData>) => void;
  trade_extra: (msg: MarketDataMessage<TradeExtraData>) => void;
  expected_price: (msg: MarketDataMessage<ExpectedPriceData>) => void;
  estimated_market_index: (msg: MarketDataMessage<EstimatedMarketIndexData>) => void;
  foreign: (msg: MarketDataMessage<ForeignInvestorData>) => void;
  session: (msg: MarketDataMessage<SessionData>) => void;
  // Trading / account per-type events (private).
  order_event: (msg: MarketDataMessage<OrderEventData>) => void;
  position_event: (msg: MarketDataMessage<PositionEventData>) => void;
  account: (msg: MarketDataMessage<AccountUpdateData>) => void;
}
