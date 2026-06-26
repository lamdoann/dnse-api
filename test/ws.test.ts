import { MarketDataWsClient } from '../src/MarketDataWsClient';
import {
  Topics,
  stockInfoTopic,
  topPriceTopic,
  ohlcTopic,
  marketIndexTopic,
} from '../src/util/topics';

describe('topic builders', () => {
  it('build the documented plaintext/quotes patterns', () => {
    expect(stockInfoTopic('HPG')).toBe('plaintext/quotes/stock/SI/HPG');
    expect(topPriceTopic('HPG')).toBe('plaintext/quotes/stock/TP/HPG');
    expect(ohlcTopic('HPG', '1')).toBe('plaintext/quotes/stock/OHLC/1/HPG');
    expect(marketIndexTopic('VNINDEX')).toBe('plaintext/quotes/index/VNINDEX');
    expect(Topics.tick('HPG')).toBe('plaintext/quotes/stock/TICK/HPG');
  });
});

describe('MarketDataWsClient (no live broker)', () => {
  it('requires investorId + token', () => {
    // @ts-expect-error intentionally missing fields
    expect(() => new MarketDataWsClient({})).toThrow(/investorId, token/);
  });

  it('queues subscriptions before connect and tracks them', () => {
    const ws = new MarketDataWsClient({ investorId: 'inv-1', token: 'jwt' });
    ws.subscribe([stockInfoTopic('HPG'), topPriceTopic('SSI')]);
    ws.subscribe(Topics.tick('VNM'));
    expect(ws.getSubscriptions().sort()).toEqual(
      [
        'plaintext/quotes/stock/SI/HPG',
        'plaintext/quotes/stock/TICK/VNM',
        'plaintext/quotes/stock/TP/SSI',
      ].sort(),
    );
    expect(ws.isConnected()).toBe(false);
  });

  it('drops topics on unsubscribe', () => {
    const ws = new MarketDataWsClient({ investorId: 'inv-1', token: 'jwt' });
    ws.subscribe([stockInfoTopic('HPG'), topPriceTopic('HPG')]);
    ws.unsubscribe(stockInfoTopic('HPG'));
    expect(ws.getSubscriptions()).toEqual(['plaintext/quotes/stock/TP/HPG']);
  });

  it('close() resolves cleanly when never connected', async () => {
    const ws = new MarketDataWsClient({ investorId: 'inv-1', token: 'jwt' });
    await expect(ws.close()).resolves.toBeUndefined();
  });
});
