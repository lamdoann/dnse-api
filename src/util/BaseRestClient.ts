import axios, { AxiosInstance, AxiosRequestConfig, Method } from 'axios';

import {
  APICredentials,
  DryRunResult,
  HmacAlgorithm,
  RequestOptions,
  RestClientOptions,
} from '../types/client';
import { DNSEAPIError } from './DNSEAPIError';
import { DefaultLogger } from './logger';
import {
  buildSigningString,
  formatDateHeader,
  generateNonce,
  signedHeadersList,
  signMessage,
} from './node-support';
import { appendQuery, serialiseParams } from './requestUtils';

const DEFAULT_BASE_URL = 'https://openapi.dnse.com.vn';

/** Internal descriptor of a request before it is dispatched. */
interface PreparedRequest {
  method: Method;
  /** Path including query string (used for signing). */
  path: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

/**
 * Abstract base for DNSE REST clients.
 *
 * Mirrors the tiagosiebler architecture: subclasses get `get/post/put/delete`
 * for public endpoints and `getPrivate/postPrivate/putPrivate/deletePrivate`
 * for signed ones, all funnelling through a single `_call()`. Signing follows
 * the DNSE HMAC HTTP-signature scheme (Date + X-Signature + x-api-key headers).
 */
export abstract class BaseRestClient {
  private readonly credentials: APICredentials | null;
  private readonly algorithm: HmacAlgorithm;
  private readonly nonceEnabled: boolean;
  private readonly defaultDryRun: boolean;

  protected readonly baseUrl: string;
  protected readonly logger: DefaultLogger;
  protected readonly axiosInstance: AxiosInstance;

  constructor(options: RestClientOptions = {}, requestOptions: AxiosRequestConfig = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.algorithm = options.algorithm || 'hmac-sha256';
    this.nonceEnabled = options.hmacNonceEnabled ?? true;
    this.defaultDryRun = options.dryRun ?? false;
    this.logger = options.logger || DefaultLogger;

    this.credentials =
      options.apiKey && options.apiSecret
        ? { apiKey: options.apiKey, apiSecret: options.apiSecret }
        : null;

    this.axiosInstance = axios.create({
      timeout: 30_000,
      ...requestOptions,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...requestOptions.headers,
      },
    });
  }

  // ----- Public (unsigned) helpers --------------------------------------

  protected get<T>(path: string, params?: object, options?: RequestOptions) {
    return this._call<T>('GET', path, params, undefined, false, options);
  }

  protected post<T>(path: string, body?: object, options?: RequestOptions) {
    return this._call<T>('POST', path, undefined, body, false, options);
  }

  protected put<T>(path: string, body?: object, options?: RequestOptions) {
    return this._call<T>('PUT', path, undefined, body, false, options);
  }

  protected delete<T>(path: string, params?: object, options?: RequestOptions) {
    return this._call<T>('DELETE', path, params, undefined, false, options);
  }

  // ----- Private (signed) helpers ---------------------------------------

  protected getPrivate<T>(path: string, params?: object, options?: RequestOptions) {
    return this._call<T>('GET', path, params, undefined, true, options);
  }

  protected postPrivate<T>(path: string, body?: object, options?: RequestOptions) {
    return this._call<T>('POST', path, undefined, body, true, options);
  }

  protected putPrivate<T>(path: string, body?: object, options?: RequestOptions) {
    return this._call<T>('PUT', path, undefined, body, true, options);
  }

  protected deletePrivate<T>(path: string, params?: object, options?: RequestOptions) {
    return this._call<T>('DELETE', path, params, undefined, true, options);
  }

  // ----- Core ------------------------------------------------------------

  private prepareRequest(
    method: Method,
    path: string,
    params: object | undefined,
    body: unknown,
    signed: boolean,
    options?: RequestOptions,
  ): PreparedRequest {
    const query = serialiseParams(params as Record<string, unknown>);
    const pathWithQuery = appendQuery(path, query);

    const headers: Record<string, string> = {};

    if (signed) {
      if (!this.credentials) {
        throw new DNSEAPIError(
          'API key & secret are required for this endpoint. ' +
            'Construct the client with { apiKey, apiSecret }.',
          { request: `${method} ${path}` },
        );
      }

      const date = formatDateHeader();
      const nonce = this.nonceEnabled ? generateNonce() : undefined;
      const signingString = buildSigningString(method, pathWithQuery, date, nonce);
      const signature = signMessage(this.credentials.apiSecret, signingString, this.algorithm);

      const sigFields = [
        `keyId="${this.credentials.apiKey}"`,
        `algorithm="${this.algorithm}"`,
        `headers="${signedHeadersList(nonce)}"`,
      ];
      if (nonce) {
        sigFields.push(`nonce="${nonce}"`);
        headers['Nonce'] = nonce;
      }
      sigFields.push(`signature="${signature}"`);

      headers['Date'] = date;
      headers['X-Signature'] = sigFields.join(',');
      headers['x-api-key'] = this.credentials.apiKey;
    }

    // Trading token for order-mutating endpoints.
    if (options?.tradingToken) {
      headers['trading-token'] = options.tradingToken;
    }

    return {
      method,
      path: pathWithQuery,
      url: `${this.baseUrl}${pathWithQuery}`,
      headers,
      body,
    };
  }

  private async _call<T>(
    method: Method,
    path: string,
    params: object | undefined,
    body: unknown,
    signed: boolean,
    options?: RequestOptions,
  ): Promise<T | DryRunResult> {
    const req = this.prepareRequest(method, path, params, body, signed, options);

    const dryRun = options?.dryRun ?? this.defaultDryRun;
    if (dryRun) {
      const descriptor: DryRunResult = {
        dryRun: true,
        method,
        url: req.url,
        headers: req.headers,
        params,
        body,
      };
      this.logger.info('[dryRun]', descriptor);
      return descriptor;
    }

    this.logger.trace('request', req.method, req.path, req.headers);

    try {
      const response = await this.axiosInstance.request<T>({
        method,
        url: req.url,
        headers: req.headers,
        data: body,
        ...options?.axiosOptions,
      });
      this.logger.trace('response', response.status, req.path);
      return response.data;
    } catch (err: unknown) {
      throw this.normaliseError(err, `${method} ${path}`);
    }
  }

  private normaliseError(err: unknown, request: string): DNSEAPIError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      const message =
        (data && typeof data === 'object' && 'message' in data
          ? String((data as Record<string, unknown>).message)
          : undefined) || err.message;
      return new DNSEAPIError(message, { status, body: data, request });
    }
    return new DNSEAPIError(err instanceof Error ? err.message : String(err), { request });
  }
}
