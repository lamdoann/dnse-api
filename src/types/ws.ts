import { DefaultLogger } from '../util/logger';

/**
 * Credentials & connection options for the DNSE realtime market-data feed
 * (MQTT over secure WebSocket).
 *
 * NOTE: this feed uses the LightSpeed / EntradeX **JWT** auth (investorId +
 * token), which is different from the OpenAPI HMAC api-key/secret used by
 * {@link RestClient}. Obtain the JWT via {@link EntradeAuthClient.login} or
 * your own login flow.
 */
export interface MarketDataWsOptions {
  /** Investor id — used as the MQTT username. */
  investorId: string;
  /** JWT access token — used as the MQTT password (valid ~8h). */
  token: string;

  /**
   * Broker host.
   * @default 'datafeed-lts-krx.dnse.com.vn'
   */
  host?: string;
  /** @default 443 */
  port?: number;
  /**
   * WebSocket path on the broker.
   * @default '/wss'
   */
  path?: string;
  /**
   * Prefix used when generating the MQTT clientId. The full id becomes
   * `${clientIdPrefix}-${investorId}-${random}`.
   * @default 'dnse-price-json-mqtt-ws-sub'
   */
  clientIdPrefix?: string;

  /**
   * MQTT protocol version. DNSE's broker speaks MQTT 5.
   * @default 5
   */
  protocolVersion?: 4 | 5;
  /** Keepalive in seconds. @default 60 */
  keepalive?: number;
  /**
   * Delay between reconnect attempts in ms. Set 0 to disable auto-reconnect.
   * @default 3000
   */
  reconnectPeriod?: number;
  /** Connect timeout in ms. @default 30000 */
  connectTimeout?: number;

  /** Inject a custom logger. */
  logger?: DefaultLogger;
}

/** A decoded market-data message delivered on a topic. */
export interface MarketDataMessage<T = unknown> {
  topic: string;
  /** Parsed JSON payload (falls back to the raw string if not JSON). */
  data: T;
  /** Raw payload bytes as a UTF-8 string. */
  raw: string;
}

/** Strongly-typed event map emitted by {@link MarketDataWsClient}. */
export interface MarketDataWsEvents {
  /** Connected & authenticated with the broker. */
  open: () => void;
  /** Connection closed. */
  close: () => void;
  /** A reconnect attempt is starting. */
  reconnect: () => void;
  /** Transport / protocol error. */
  error: (err: Error) => void;
  /** Any decoded message on any subscribed topic. */
  message: (msg: MarketDataMessage) => void;
}
