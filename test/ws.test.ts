import * as crypto from 'crypto';

import { WebsocketClient, MarketDataWsClient } from '../src';
import { signWsAuth } from '../src/util/node-support';
import { DEFAULT_BOARDS, WS_MESSAGE_TYPES } from '../src/types/ws';

describe('signWsAuth', () => {
  it('produces hex HMAC-SHA256 of "apiKey:timestamp:nonce"', () => {
    const expected = crypto
      .createHmac('sha256', Buffer.from('secret', 'utf8'))
      .update('key:1700000000:999')
      .digest('hex');
    expect(signWsAuth('secret', 'key', 1700000000, 999)).toBe(expected);
    // hex, not base64/url-encoded
    expect(signWsAuth('secret', 'key', 1, 2)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('MarketDataWsClient (no live socket)', () => {
  it('requires apiKey + apiSecret', () => {
    // @ts-expect-error missing fields
    expect(() => new WebsocketClient({})).toThrow(/apiKey, apiSecret/);
  });

  it('builds ohlc channel with resolution + json suffix', () => {
    const ws = new WebsocketClient({ apiKey: 'k', apiSecret: 's' });
    ws.subscribeOhlc(['VN30F1M', 'SSI'], '1');
    expect(ws.getChannels()).toEqual(['ohlc.1.json']);
  });

  it('fans a trade subscription across all default boards', () => {
    const ws = new WebsocketClient({ apiKey: 'k', apiSecret: 's' });
    ws.subscribeTrade(['HPG']);
    expect(ws.getChannels()).toEqual(DEFAULT_BOARDS.map((b) => `tick.${b}.json`));
  });

  it('builds market_index channels without symbols', () => {
    const ws = new WebsocketClient({ apiKey: 'k', apiSecret: 's' });
    ws.subscribeMarketIndex(['VNINDEX', 'VN30']);
    expect(ws.getChannels()).toEqual([
      'market_index.VNINDEX.json',
      'market_index.VN30.json',
    ]);
  });

  it('unsubscribe drops the tracked channel', () => {
    const ws = new WebsocketClient({ apiKey: 'k', apiSecret: 's' });
    ws.subscribeQuote(['HPG'], ['G1']);
    expect(ws.getChannels()).toEqual(['top_price.G1.json']);
    ws.unsubscribe('top_price.G1.json');
    expect(ws.getChannels()).toEqual([]);
  });

  it('is not connected before connect()', () => {
    const ws = new WebsocketClient({ apiKey: 'k', apiSecret: 's' });
    expect(ws.isConnected()).toBe(false);
  });

  it('maps the T discriminator to friendly names', () => {
    expect(WS_MESSAGE_TYPES['b']).toBe('ohlc');
    expect(WS_MESSAGE_TYPES['q']).toBe('quote');
    expect(WS_MESSAGE_TYPES['t']).toBe('trade');
    expect(WS_MESSAGE_TYPES['mi']).toBe('market_index');
    expect(WS_MESSAGE_TYPES['do']).toBe('order_event');
    expect(WS_MESSAGE_TYPES['dp']).toBe('position_event');
    expect(WS_MESSAGE_TYPES['a']).toBe('account');
  });

  it('builds private trading/account channels', () => {
    const ws = new WebsocketClient({ apiKey: 'k', apiSecret: 's' });
    ws.subscribeOrders();
    ws.subscribePositions();
    ws.subscribeAccount();
    ws.subscribeOrderEvent('DERIVATIVE');
    ws.subscribePositionEvent(); // default STOCK
    ws.subscribeBrokerOrderEvent('0001000115', 'STOCK');
    ws.subscribeBrokerPositionEvent('0001000115');
    expect(ws.getChannels()).toEqual([
      'orders',
      'positions',
      'account',
      'order.DERIVATIVE.json',
      'position.STOCK.json',
      'order.broker.STOCK.0001000115.json',
      'position.broker.STOCK.0001000115.json',
    ]);
  });

  it('MarketDataWsClient is an alias of WebsocketClient', () => {
    expect(MarketDataWsClient).toBe(WebsocketClient);
  });

  it('close() resolves cleanly when never connected', async () => {
    const ws = new WebsocketClient({ apiKey: 'k', apiSecret: 's' });
    await expect(ws.close()).resolves.toBeUndefined();
  });
});
