import { EventEmitter } from 'events';

import WebSocket from 'ws';

import { DefaultLogger } from './util/logger';
import { signWsAuth } from './util/node-support';
import {
  ChannelSpec,
  DEFAULT_BOARDS,
  MarketDataMessage,
  MarketDataWsEvents,
  MarketDataWsOptions,
  WS_MESSAGE_TYPES,
} from './types/ws';
import { MarketType, OhlcResolution } from './types/shared';

const DEFAULT_BASE_URL = 'wss://ws-openapi.dnse.com.vn';
const ENCODING = 'json';

// Typed EventEmitter surface.
export declare interface WebsocketClient {
  on<E extends keyof MarketDataWsEvents>(event: E, listener: MarketDataWsEvents[E]): this;
  once<E extends keyof MarketDataWsEvents>(event: E, listener: MarketDataWsEvents[E]): this;
  off<E extends keyof MarketDataWsEvents>(event: E, listener: MarketDataWsEvents[E]): this;
  emit<E extends keyof MarketDataWsEvents>(
    event: E,
    ...args: Parameters<MarketDataWsEvents[E]>
  ): boolean;
}

/**
 * Realtime client for the **DNSE OpenAPI** WebSocket feed
 * (`wss://ws-openapi.dnse.com.vn`) — plain WebSocket, JSON frames, HMAC auth
 * handshake using the same `apiKey`/`apiSecret` as {@link RestClient}.
 *
 * Handles both **market data** (ohlc, quote, trade, index, security definition)
 * and **private trading/account** streams (orders, positions, account, order &
 * position events). Mirrors the tiagosiebler `WebsocketClient` pattern: an
 * EventEmitter you `connect()`, then subscribe via typed helpers.
 *
 * @example
 * ```ts
 * const ws = new WebsocketClient({ apiKey, apiSecret });
 * ws.on('open', () => {
 *   ws.subscribeOhlc(['VN30F1M'], '1');
 *   ws.subscribeOrders();
 * });
 * ws.on('ohlc', (m) => console.log(m.data));
 * ws.on('order_event', (m) => console.log(m.data));
 * ws.connect();
 * ```
 */
export class WebsocketClient extends EventEmitter {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly reconnectPeriod: number;
  private readonly maxReconnectAttempts: number;
  private readonly pingInterval: number;
  private readonly logger: DefaultLogger;

  private ws: WebSocket | null = null;
  private authenticated = false;
  private reconnectAttempts = 0;
  private closing = false;
  private pingTimer: NodeJS.Timeout | null = null;
  private hasConnectedOnce = false;

  /** Tracked channels (name -> symbols), re-subscribed after reconnect. */
  private readonly channels = new Map<string, string[] | undefined>();

  constructor(options: MarketDataWsOptions) {
    super();
    if (!options.apiKey || !options.apiSecret) {
      throw new Error('WebsocketClient requires { apiKey, apiSecret }.');
    }
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.reconnectPeriod = options.reconnectPeriod ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.pingInterval = options.pingInterval ?? 25_000;
    this.logger = options.logger || DefaultLogger;
  }

  // ===================================================================
  // Connection lifecycle
  // ===================================================================

  /** Open the connection and authenticate. */
  connect(): this {
    if (this.ws) {
      this.logger.warning('connect() called but a socket already exists');
      return this;
    }
    this.closing = false;
    const url = `${this.baseUrl}/v1/stream?encoding=${ENCODING}`;
    this.logger.trace('connecting', url);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      this.logger.trace('socket open, sending auth');
      this.sendAuth();
    });
    ws.on('message', (raw: WebSocket.RawData) => this.handleRaw(raw));
    ws.on('error', (err) => {
      this.logger.error('ws error', err);
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    });
    ws.on('close', () => {
      this.logger.info('ws closed');
      this.cleanupSocket();
      this.emit('close');
      this.maybeReconnect();
    });

    return this;
  }

  /** Close the connection and stop reconnecting. */
  async close(): Promise<void> {
    this.closing = true;
    this.stopPing();
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }
      const ws = this.ws;
      ws.once('close', () => resolve());
      ws.close();
    });
  }

  private cleanupSocket(): void {
    this.stopPing();
    this.authenticated = false;
    this.ws = null;
  }

  private maybeReconnect(): void {
    if (this.closing || this.reconnectPeriod <= 0) {
      return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }
    this.reconnectAttempts += 1;
    const delay = this.reconnectPeriod * Math.min(this.reconnectAttempts, 5);
    this.logger.info(`reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit('reconnect');
    setTimeout(() => {
      if (!this.closing) {
        this.connect();
      }
    }, delay);
  }

  // ===================================================================
  // Auth handshake
  // ===================================================================

  private sendAuth(): void {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = `${Date.now() * 1000 + Math.floor(Math.random() * 1000)}`;
    const signature = signWsAuth(this.apiSecret, this.apiKey, timestamp, nonce);
    this.sendRaw({
      action: 'auth',
      api_key: this.apiKey,
      signature,
      timestamp,
      nonce,
    });
  }

  // ===================================================================
  // Subscriptions
  // ===================================================================

  private channelSuffix(): string {
    return `.${ENCODING}`;
  }

  /**
   * Subscribe to OHLC candles for symbols at a resolution.
   *
   * NOTE (verified live): the OHLC channel matches on the FRIENDLY ticker
   * (e.g. `VN30F1M`, `HPG`) — i.e. an instrument's `symbolType`. This differs
   * from {@link subscribeTrade}/{@link subscribeQuote}/{@link subscribeSecDef},
   * which match on the raw KRX code (`symbol`, e.g. `41I1G8000`). For stocks
   * the two are identical; for derivatives they differ.
   */
  subscribeOhlc(symbols: string[], resolution: OhlcResolution): this {
    return this.subscribeChannel({ name: `ohlc.${resolution}${this.channelSuffix()}`, symbols });
  }

  /**
   * Subscribe to trade (tick) data for symbols across the given boards.
   *
   * NOTE (verified live): match on the raw KRX code (`symbol`, e.g.
   * `41I1G8000`), NOT the friendly ticker. Derivative ticks arrive on board
   * `G1` (already in {@link DEFAULT_BOARDS}).
   */
  subscribeTrade(symbols: string[], boards: readonly string[] = DEFAULT_BOARDS): this {
    return this.subscribeChannel(
      boards.map((b) => ({ name: `tick.${b}${this.channelSuffix()}`, symbols })),
    );
  }

  /**
   * Subscribe to top-of-book quotes for symbols across the given boards.
   * Like {@link subscribeTrade}, match on the raw KRX code (`symbol`).
   */
  subscribeQuote(symbols: string[], boards: readonly string[] = DEFAULT_BOARDS): this {
    return this.subscribeChannel(
      boards.map((b) => ({ name: `top_price.${b}${this.channelSuffix()}`, symbols })),
    );
  }

  /**
   * Subscribe to security-definition updates for symbols across boards.
   * Like {@link subscribeTrade}, match on the raw KRX code (`symbol`).
   */
  subscribeSecDef(symbols: string[], boards: readonly string[] = DEFAULT_BOARDS): this {
    return this.subscribeChannel(
      boards.map((b) => ({ name: `security_definition.${b}${this.channelSuffix()}`, symbols })),
    );
  }

  /** Subscribe to one or more market indices (e.g. `VNINDEX`, `VN30`, `HNXINDEX`). */
  subscribeMarketIndex(indices: string[]): this {
    return this.subscribeChannel(
      indices.map((i) => ({ name: `market_index.${i}${this.channelSuffix()}` })),
    );
  }

  // ----- Private: trading & account (require api key/secret) -------------

  /** Subscribe to the authenticated user's order updates (`orders`). */
  subscribeOrders(): this {
    return this.subscribeChannel({ name: 'orders' });
  }

  /** Subscribe to the authenticated user's position updates (`positions`). */
  subscribePositions(): this {
    return this.subscribeChannel({ name: 'positions' });
  }

  /** Subscribe to account-level updates (cash/asset changes) (`account`). */
  subscribeAccount(): this {
    return this.subscribeChannel({ name: 'account' });
  }

  /** Subscribe to order events for a market (`order.{marketType}.json`). */
  subscribeOrderEvent(marketType: MarketType = 'STOCK'): this {
    return this.subscribeChannel({ name: `order.${marketType}${this.channelSuffix()}` });
  }

  /** Subscribe to position events for a market (`position.{marketType}.json`). */
  subscribePositionEvent(marketType: MarketType = 'STOCK'): this {
    return this.subscribeChannel({ name: `position.${marketType}${this.channelSuffix()}` });
  }

  /**
   * Broker-level order events for a specific investor
   * (`order.broker.{marketType}.{investorId}.json`). `investorId` comes from
   * {@link RestClient.getAccounts}.
   */
  subscribeBrokerOrderEvent(investorId: string, marketType: MarketType = 'STOCK'): this {
    return this.subscribeChannel({
      name: `order.broker.${marketType}.${investorId}${this.channelSuffix()}`,
    });
  }

  /**
   * Broker-level position events for a specific investor
   * (`position.broker.{marketType}.{investorId}.json`).
   */
  subscribeBrokerPositionEvent(investorId: string, marketType: MarketType = 'STOCK'): this {
    return this.subscribeChannel({
      name: `position.broker.${marketType}.${investorId}${this.channelSuffix()}`,
    });
  }

  /** Low-level: subscribe to raw channel spec(s). Escape hatch for any channel. */
  subscribeChannel(channels: ChannelSpec | ChannelSpec[]): this {
    const list = Array.isArray(channels) ? channels : [channels];
    list.forEach((c) => this.channels.set(c.name, c.symbols));
    if (this.authenticated) {
      this.sendRaw({ action: 'subscribe', channels: list });
    }
    return this;
  }

  /** Unsubscribe from channel(s) by name. */
  unsubscribe(names: string | string[]): this {
    const list = Array.isArray(names) ? names : [names];
    const specs = list.map((name) => ({ name, symbols: this.channels.get(name) }));
    list.forEach((n) => this.channels.delete(n));
    if (this.authenticated) {
      this.sendRaw({ action: 'unsubscribe', channels: specs });
    }
    return this;
  }

  private resubscribeAll(): void {
    if (this.channels.size === 0) {
      return;
    }
    const specs: ChannelSpec[] = [...this.channels.entries()].map(([name, symbols]) => ({
      name,
      symbols,
    }));
    this.sendRaw({ action: 'subscribe', channels: specs });
    this.logger.trace('resubscribed', specs.length, 'channels');
  }

  /** Names of the channels currently tracked. */
  getChannels(): string[] {
    return [...this.channels.keys()];
  }

  /** Whether the socket is connected and authenticated. */
  isConnected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  // ===================================================================
  // Message handling
  // ===================================================================

  private handleRaw(raw: WebSocket.RawData): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      this.emit('error', new Error(`Failed to parse ws message: ${(err as Error).message}`));
      return;
    }

    // Control frames carry an `action`; data frames carry a `T` discriminator.
    if (typeof msg.action === 'string') {
      this.handleControl(msg as { action: string; message?: string });
      return;
    }
    if (typeof msg.T === 'string') {
      this.handleData(msg);
    }
  }

  private handleControl(msg: { action: string; message?: string }): void {
    switch (msg.action) {
      case 'auth_success': {
        this.authenticated = true;
        const wasReconnect = this.hasConnectedOnce;
        this.hasConnectedOnce = true;
        this.reconnectAttempts = 0;
        this.startPing();
        this.resubscribeAll();
        this.emit('open');
        if (wasReconnect) {
          this.emit('reconnected');
        }
        break;
      }
      case 'auth_error':
        this.emit('error', new Error(`Authentication failed: ${msg.message ?? 'unknown'}`));
        break;
      case 'ping':
        this.sendRaw({ action: 'pong' });
        break;
      case 'pong':
        // heartbeat acknowledged
        break;
      default:
        this.logger.trace('unhandled control frame', msg.action);
    }
  }

  private handleData(msg: Record<string, unknown>): void {
    const rawType = msg.T as string;
    const type = WS_MESSAGE_TYPES[rawType] || rawType;
    // Derive turnover (giá trị giao dịch) = volume * close for ohlc frames.
    if (type === 'ohlc' || type === 'ohlc_closed') {
      const { volume, close } = msg as { volume?: unknown; close?: unknown };
      if (typeof volume === 'number' && typeof close === 'number') {
        msg.turnover = volume * close;
      }
    }
    const decoded: MarketDataMessage = { type, rawType, data: msg };
    this.emit('message', decoded);
    // Emit a per-type event when it's one of the declared convenience events.
    this.emit(type as keyof MarketDataWsEvents, decoded as never);
  }

  // ===================================================================
  // Heartbeat & low-level send
  // ===================================================================

  private startPing(): void {
    this.stopPing();
    if (this.pingInterval <= 0) {
      return;
    }
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendRaw({ action: 'ping' });
      }
    }, this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendRaw(obj: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.logger.warning('sendRaw called while socket not open');
      return;
    }
    this.ws.send(JSON.stringify(obj));
  }
}
