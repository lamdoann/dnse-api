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

/** List of signed headers, in order, for the `headers="..."` signature field. */
export function signedHeadersList(nonce?: string): string {
  return nonce ? '(request-target) date nonce' : '(request-target) date';
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
