import { OtpType } from './shared';

export interface SendEmailOtpParams {
  email: string;
}

/** Mint a short-lived trading token from a one-time passcode. */
export interface CreateTradingTokenParams {
  /** Which OTP channel produced the passcode. */
  otpType: OtpType;
  /** The OTP code entered by the user. */
  passcode: string;
}

export interface TradingTokenResponse {
  /** The token to pass as `trading-token` on order endpoints. */
  tradingToken: string;
  /** Lifetime in seconds, if returned. */
  expiresIn?: number;
  [key: string]: unknown;
}
