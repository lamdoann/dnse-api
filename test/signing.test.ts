import * as crypto from 'crypto';

import {
  buildSigningString,
  signMessage,
  signedHeadersList,
} from '../src/util/node-support';
import { serialiseParams, appendQuery, fillPathParams } from '../src/util/requestUtils';
import { RestClient } from '../src';
import { DryRunResult } from '../src/types';

describe('signing string', () => {
  it('builds the draft-cavage request-target + date string', () => {
    const s = buildSigningString('GET', '/accounts', 'Tue, 24 Jun 2026 09:30:00 GMT');
    expect(s).toBe('(request-target): get /accounts\ndate: Tue, 24 Jun 2026 09:30:00 GMT');
  });

  it('appends the nonce line when present', () => {
    const s = buildSigningString('POST', '/accounts/orders', 'D', 'abc');
    expect(s).toBe('(request-target): post /accounts/orders\ndate: D\nnonce: abc');
  });

  it('has a constant signed-headers list (nonce not listed)', () => {
    expect(signedHeadersList()).toBe('(request-target) date');
  });
});

describe('signMessage', () => {
  it('matches a reference HMAC-SHA256 (base64 + url-encoded)', () => {
    const secret = 'my-secret';
    const msg = '(request-target): get /accounts\ndate: D';
    const expected = encodeURIComponent(
      crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(msg).digest('base64'),
    );
    expect(signMessage(secret, msg, 'hmac-sha256')).toBe(expected);
  });
});

describe('requestUtils', () => {
  it('serialises params, dropping empties', () => {
    expect(serialiseParams({ a: 1, b: undefined, c: 'x', d: null })).toBe('a=1&c=x');
  });

  it('appends query respecting existing ?', () => {
    expect(appendQuery('/p', 'a=1')).toBe('/p?a=1');
    expect(appendQuery('/p?x=1', 'a=1')).toBe('/p?x=1&a=1');
    expect(appendQuery('/p', '')).toBe('/p');
  });

  it('fills path params and throws on missing', () => {
    expect(fillPathParams('/a/{id}/b', { id: 7 })).toBe('/a/7/b');
    expect(() => fillPathParams('/a/{id}', {})).toThrow(/Missing path parameter/);
  });
});

describe('RestClient dryRun', () => {
  const client = new RestClient({ apiKey: 'k', apiSecret: 's', dryRun: true });

  it('signs private requests with the expected headers', async () => {
    const r = (await client.getAccounts()) as DryRunResult;
    expect(r.dryRun).toBe(true);
    expect(r.url).toBe('https://openapi.dnse.com.vn/accounts');
    expect(r.headers['x-api-key']).toBe('k');
    expect(r.headers['Date']).toBeDefined();
    // Draft-cavage value: `Signature ` scheme prefix, constant headers list,
    // nonce inside the value (no separate Nonce header).
    expect(r.headers['X-Signature']).toMatch(/^Signature keyId="k",/);
    expect(r.headers['X-Signature']).toContain('algorithm="hmac-sha256"');
    expect(r.headers['X-Signature']).toContain('headers="(request-target) date"');
    expect(r.headers['Nonce']).toBeUndefined();
  });

  it('signs market-data requests too (OpenAPI signs everything)', async () => {
    const r = (await client.getOhlc('DERIVATIVE', {
      symbol: 'VN30F1M',
      resolution: '1D',
      from: 1,
      to: 2,
    })) as DryRunResult;
    expect(r.headers['X-Signature']).toContain('keyId="k"');
    expect(r.url).toContain('type=DERIVATIVE');
    expect(r.url).toContain('symbol=VN30F1M');
  });

  it('attaches the trading-token header on order placement', async () => {
    const r = (await client.placeOrder(
      'STOCK',
      { accountNo: '1', symbol: 'HPG', side: 'BUY', orderType: 'LO', price: 1, quantity: 100 },
      { tradingToken: 'tok' },
    )) as DryRunResult;
    expect(r.headers['trading-token']).toBe('tok');
    expect(r.url).toContain('marketType=STOCK');
  });

  it('throws when calling a private endpoint without credentials', async () => {
    const anon = new RestClient({ dryRun: true });
    await expect(anon.getAccounts()).rejects.toThrow(/API key & secret are required/);
  });
});
