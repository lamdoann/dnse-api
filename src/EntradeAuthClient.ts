import axios, { AxiosInstance } from 'axios';

import { DNSEAPIError } from './util/DNSEAPIError';
import { DefaultLogger } from './util/logger';

/**
 * Helper to obtain the JWT credentials needed by {@link MarketDataWsClient}.
 *
 * The realtime feed authenticates with the DNSE/EntradeX user JWT (not the
 * OpenAPI HMAC key/secret). This client performs username/password login and
 * resolves the `investorId`.
 *
 * ⚠️ VERIFY: the auth endpoints below follow the documented EntradeX flow
 * (`/user-service/api/auth` + `/user-service/api/me`). They could not be
 * machine-verified here — confirm against the live DNSE docs and adjust the
 * paths/fields if your account uses a different gateway.
 */
export class EntradeAuthClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger: DefaultLogger;

  constructor(
    options: { baseUrl?: string; logger?: DefaultLogger } = {},
  ) {
    this.logger = options.logger || DefaultLogger;
    this.axiosInstance = axios.create({
      baseURL: (options.baseUrl || 'https://api.dnse.com.vn').replace(/\/$/, ''),
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
  }

  /**
   * Log in with username (email / phone / custody code) + password.
   * @returns the JWT access token (valid ~8h).
   */
  async login(username: string, password: string): Promise<string> {
    try {
      const res = await this.axiosInstance.post<{ token: string }>(
        '/user-service/api/auth',
        { username, password },
      );
      const token = res.data?.token;
      if (!token) {
        throw new DNSEAPIError('Login succeeded but no token was returned', {
          status: res.status,
          body: res.data,
          request: 'POST /user-service/api/auth',
        });
      }
      return token;
    } catch (err) {
      throw this.wrap(err, 'POST /user-service/api/auth');
    }
  }

  /** Resolve the investor profile (incl. `investorId`) from a JWT. */
  async getInvestorInfo(token: string): Promise<{ investorId: string; [k: string]: unknown }> {
    try {
      const res = await this.axiosInstance.get<{ investorId: string }>(
        '/user-service/api/me',
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.data;
    } catch (err) {
      throw this.wrap(err, 'GET /user-service/api/me');
    }
  }

  /**
   * One-shot: log in and resolve both pieces needed to open the market-data
   * feed. Feed the result straight into {@link MarketDataWsClient}.
   */
  async authenticate(
    username: string,
    password: string,
  ): Promise<{ investorId: string; token: string }> {
    const token = await this.login(username, password);
    const { investorId } = await this.getInvestorInfo(token);
    return { investorId, token };
  }

  private wrap(err: unknown, request: string): DNSEAPIError {
    if (err instanceof DNSEAPIError) {
      return err;
    }
    if (axios.isAxiosError(err)) {
      return new DNSEAPIError(err.message, {
        status: err.response?.status,
        body: err.response?.data,
        request,
      });
    }
    return new DNSEAPIError(err instanceof Error ? err.message : String(err), { request });
  }
}
