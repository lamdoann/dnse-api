import * as crypto from 'crypto';

import { HmacAlgorithm } from '../types/client';

/** Map a `hmac-shaXXX` algorithm name to a Node crypto digest name. */
function resolveDigest(algorithm: HmacAlgorithm): string {
  switch (algorithm) {
    case 'hmac-sha256':
      return 'sha256';
    case 'hmac-sha384':
      return 'sha384';
    case 'hmac-sha512':
      return 'sha512';
    default:
      return 'sha256';
  }
}

/**
 * Build the signing string per the draft-cavage HTTP-signatures scheme that
 * DNSE uses:
 *
 *   (request-target): <method> <path>
 *   date: <date>
 *   [nonce: <nonce>]
 *
 * Note: `path` must include the query string exactly as it is sent.
 */
export function buildSigningString(
  method: string,
  path: string,
  date: string,
  nonce?: string,
): string {
  let signingString = `(request-target): ${method.toLowerCase()} ${path}\n`;
  signingString += `date: ${date}`;
  if (nonce) {
    signingString += `\nnonce: ${nonce}`;
  }
  return signingString;
}

/**
 * The `headers="..."` list embedded in the signature value. Per the DNSE
 * scheme this is a constant `(request-target) date` — the nonce is signed (it
 * appears in the signing string) but is NOT listed here.
 */
export function signedHeadersList(): string {
  return '(request-target) date';
}

/**
 * HMAC-sign a signing string and return a URL-encoded base64 signature,
 * matching the official DNSE SDK behaviour.
 */
export function signMessage(
  secret: string,
  signingString: string,
  algorithm: HmacAlgorithm,
): string {
  const digest = resolveDigest(algorithm);
  const hmac = crypto.createHmac(digest, Buffer.from(secret, 'utf8'));
  hmac.update(signingString, 'utf8');
  const encoded = hmac.digest('base64');
  return encodeURIComponent(encoded);
}

/** Generate a random nonce for replay protection. */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** RFC-1123 / RFC-7231 date header in UTC, e.g. `Tue, 24 Jun 2026 09:30:00 GMT`. */
export function formatDateHeader(date: Date = new Date()): string {
  return date.toUTCString();
}

/**
 * Signature for the OpenAPI realtime WebSocket auth handshake.
 *
 * The signed message is `${apiKey}:${timestamp}:${nonce}` and the result is a
 * lowercase **hex** HMAC-SHA256 (note: different encoding from the REST
 * signature, which is base64 + URL-encoded).
 */
export function signWsAuth(
  apiSecret: string,
  apiKey: string,
  timestamp: number | string,
  nonce: number | string,
): string {
  const message = `${apiKey}:${timestamp}:${nonce}`;
  return crypto
    .createHmac('sha256', Buffer.from(apiSecret, 'utf8'))
    .update(message, 'utf8')
    .digest('hex');
}
