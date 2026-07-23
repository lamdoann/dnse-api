/**
 * Market-data example. NOTE: the OpenAPI gateway signs every request, so even
 * price data needs an API key/secret.
 *
 *   DNSE_API_KEY=... DNSE_API_SECRET=... npx ts-node examples/rest-public.ts
 */
import { RestClient } from '../src';

async function main() {
  const client = new RestClient({
    apiKey: process.env.DNSE_API_KEY,
    apiSecret: process.env.DNSE_API_SECRET,
  });

  const secdef = await client.getSecurityDefinition('HPG');
  console.log('Security definition:', secdef);

  const ohlc = await client.getOhlc('STOCK', {
    symbol: 'HPG',
    resolution: '1',
    from: 1735689600,
    to: 1735776000,
  });
  console.log('OHLC candles:', ohlc);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
