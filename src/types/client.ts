import { AxiosRequestConfig } from 'axios';

import { DefaultLogger } from '../util/logger';

/** Supported HMAC signing algorithms for the DNSE HTTP-signature scheme. */
export type HmacAlgorithm = 'hmac-sha256' | 'hmac-sha384' | 'hmac-sha512';

/**
 * API credentials. The key/secret pair is created and managed from the DNSE
 * developer portal and is used to sign every private REST request.
 */
export interface APICredentials {
  /** API key (sent as `x-api-key` and embedded as `keyId` in the signature). */
  apiKey: string;
  /** API secret — the HMAC signing key. Never sent over the wire. */
  apiSecret: string;
}

/**
 * Options accepted by every REST client.
 *
 * Credentials are optional: a client created without them can still call the
 * handful of public endpoints (e.g. OHLC, security definitions).
 */
export interface RestClientOptions {
  /** API key. Optional — omit for public-only usage. */
  apiKey?: string;
  /** API secret. Optional — omit for public-only usage. */
  apiSecret?: string;

  /**
   * Override the REST base URL.
   * @default 'https://openapi.dnse.com.vn'
   */
  baseUrl?: string;

  /**
   * HMAC algorithm used for the signature.
   * @default 'hmac-sha256'
   */
  algorithm?: HmacAlgorithm;

  /**
   * Include a per-request `nonce` in the signed payload to defend against
   * replay attacks.
   * @default true
   */
  hmacNonceEnabled?: boolean;

  /** Inject a custom logger. Defaults to a console logger. */
  logger?: DefaultLogger;

  /**
   * If true, every call returns the prepared request descriptor and skips the
   * network — useful for inspecting exactly what would be sent.
   * @default false
   */
  dryRun?: boolean;
}

/** Extra per-call options layered on top of the request. */
export interface RequestOptions {
  /** Override the client-level `dryRun` for a single call. */
  dryRun?: boolean;
  /** Per-call axios overrides (timeout, signal, custom headers, ...). */
  axiosOptions?: AxiosRequestConfig;
  /** Trading token minted via {@link createTradingToken}; required to trade. */
  tradingToken?: string;
}

/** Shape returned when `dryRun` is enabled — the request that *would* be sent. */
export interface DryRunResult {
  dryRun: true;
  method: string;
  url: string;
  headers: Record<string, string>;
  params?: unknown;
  body?: unknown;
}
