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

/** A decoded realtime data frame. */
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
  /** Any decoded data frame. */
  message: (msg: MarketDataMessage) => void;
  // Market-data per-type events.
  ohlc: (msg: MarketDataMessage) => void;
  quote: (msg: MarketDataMessage) => void;
  trade: (msg: MarketDataMessage) => void;
  security_definition: (msg: MarketDataMessage) => void;
  market_index: (msg: MarketDataMessage) => void;
  // Trading / account per-type events (private).
  order_event: (msg: MarketDataMessage) => void;
  position_event: (msg: MarketDataMessage) => void;
  account: (msg: MarketDataMessage) => void;
}
