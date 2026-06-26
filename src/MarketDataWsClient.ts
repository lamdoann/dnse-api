import { EventEmitter } from 'events';
import * as crypto from 'crypto';

import mqtt, { IClientOptions, MqttClient } from 'mqtt';

import { DefaultLogger } from './util/logger';
import {
  MarketDataMessage,
  MarketDataWsEvents,
  MarketDataWsOptions,
} from './types/ws';

const DEFAULTS = {
  host: 'datafeed-lts-krx.dnse.com.vn',
  port: 443,
  path: '/wss',
  clientIdPrefix: 'dnse-price-json-mqtt-ws-sub',
  protocolVersion: 5 as const,
  keepalive: 60,
  reconnectPeriod: 3000,
  connectTimeout: 30_000,
};

// Typed EventEmitter surface.
export declare interface MarketDataWsClient {
  on<E extends keyof MarketDataWsEvents>(event: E, listener: MarketDataWsEvents[E]): this;
  once<E extends keyof MarketDataWsEvents>(event: E, listener: MarketDataWsEvents[E]): this;
  off<E extends keyof MarketDataWsEvents>(event: E, listener: MarketDataWsEvents[E]): this;
  emit<E extends keyof MarketDataWsEvents>(
    event: E,
    ...args: Parameters<MarketDataWsEvents[E]>
  ): boolean;
}

/**
 * Realtime market-data client for DNSE, over MQTT (JSON payloads) on a secure
 * WebSocket — mirrors the tiagosiebler `WebsocketClient` pattern: an
 * EventEmitter you `connect()`, then `subscribe()` to topics and listen for
 * `message` events.
 *
 * @example
 * ```ts
 * const ws = new MarketDataWsClient({ investorId, token });
 * ws.on('open', () => ws.subscribe(Topics.stockInfo('HPG')));
 * ws.on('message', (m) => console.log(m.topic, m.data));
 * ws.connect();
 * ```
 */
export class MarketDataWsClient extends EventEmitter {
  private readonly options: Required<Omit<MarketDataWsOptions, 'logger'>>;
  private readonly logger: DefaultLogger;
  private client: MqttClient | null = null;
  /** Topics to (re)subscribe to — survives reconnects. */
  private readonly subscriptions = new Set<string>();

  constructor(options: MarketDataWsOptions) {
    super();
    if (!options.investorId || !options.token) {
      throw new Error(
        'MarketDataWsClient requires { investorId, token } (JWT). ' +
          'Obtain them via EntradeAuthClient.login() or your own login flow.',
      );
    }
    this.logger = options.logger || DefaultLogger;
    this.options = {
      investorId: options.investorId,
      token: options.token,
      host: options.host ?? DEFAULTS.host,
      port: options.port ?? DEFAULTS.port,
      path: options.path ?? DEFAULTS.path,
      clientIdPrefix: options.clientIdPrefix ?? DEFAULTS.clientIdPrefix,
      protocolVersion: options.protocolVersion ?? DEFAULTS.protocolVersion,
      keepalive: options.keepalive ?? DEFAULTS.keepalive,
      reconnectPeriod: options.reconnectPeriod ?? DEFAULTS.reconnectPeriod,
      connectTimeout: options.connectTimeout ?? DEFAULTS.connectTimeout,
    };
  }

  /** Build the broker-mandated clientId: `<prefix>-<investorId>-<random>`. */
  private buildClientId(): string {
    const random = crypto.randomBytes(6).toString('hex');
    return `${this.options.clientIdPrefix}-${this.options.investorId}-${random}`;
  }

  /** Open the connection. Safe to call once; use `close()` to tear down. */
  connect(): this {
    if (this.client) {
      this.logger.warning('connect() called but client already exists');
      return this;
    }

    const o = this.options;
    const url = `wss://${o.host}:${o.port}${o.path}`;
    const mqttOptions: IClientOptions = {
      clientId: this.buildClientId(),
      username: o.investorId,
      password: o.token,
      protocolVersion: o.protocolVersion,
      keepalive: o.keepalive,
      reconnectPeriod: o.reconnectPeriod,
      connectTimeout: o.connectTimeout,
      clean: true,
    };

    this.logger.trace('connecting', url, mqttOptions.clientId);
    const client = mqtt.connect(url, mqttOptions);
    this.client = client;

    client.on('connect', () => {
      this.logger.info('market-data connected');
      this.resubscribeAll();
      this.emit('open');
    });
    client.on('reconnect', () => {
      this.logger.info('market-data reconnecting');
      this.emit('reconnect');
    });
    client.on('close', () => {
      this.logger.info('market-data connection closed');
      this.emit('close');
    });
    client.on('error', (err) => {
      this.logger.error('market-data error', err);
      this.emit('error', err);
    });
    client.on('message', (topic, payload) => this.handleMessage(topic, payload));

    return this;
  }

  private handleMessage(topic: string, payload: Buffer): void {
    const raw = payload.toString('utf8');
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // Non-JSON payload — keep the raw string.
    }
    const msg: MarketDataMessage = { topic, data, raw };
    this.emit('message', msg);
    // Also emit a per-topic event for convenient targeted listeners.
    this.emit(topic as keyof MarketDataWsEvents, msg as never);
  }

  private resubscribeAll(): void {
    if (!this.client || this.subscriptions.size === 0) {
      return;
    }
    const topics = [...this.subscriptions];
    this.client.subscribe(topics, { qos: 0 }, (err) => {
      if (err) {
        this.emit('error', err);
      } else {
        this.logger.trace('resubscribed', topics);
      }
    });
  }

  /**
   * Subscribe to one or more topics. Topics are remembered and automatically
   * re-subscribed after a reconnect. If not yet connected, they are queued and
   * applied on connect.
   */
  subscribe(topics: string | string[]): this {
    const list = Array.isArray(topics) ? topics : [topics];
    list.forEach((t) => this.subscriptions.add(t));
    if (this.client?.connected) {
      this.client.subscribe(list, { qos: 0 }, (err) => {
        if (err) {
          this.emit('error', err);
        } else {
          this.logger.trace('subscribed', list);
        }
      });
    }
    return this;
  }

  /** Unsubscribe from one or more topics. */
  unsubscribe(topics: string | string[]): this {
    const list = Array.isArray(topics) ? topics : [topics];
    list.forEach((t) => this.subscriptions.delete(t));
    if (this.client?.connected) {
      this.client.unsubscribe(list, (err?: Error) => {
        if (err) {
          this.emit('error', err);
        }
      });
    }
    return this;
  }

  /** The topics currently tracked by this client. */
  getSubscriptions(): string[] {
    return [...this.subscriptions];
  }

  /** Whether the underlying MQTT client is connected. */
  isConnected(): boolean {
    return !!this.client?.connected;
  }

  /** Close the connection. Pass `force` to skip the graceful DISCONNECT. */
  close(force = false): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }
      this.client.end(force, {}, () => {
        this.client = null;
        resolve();
      });
    });
  }
}
