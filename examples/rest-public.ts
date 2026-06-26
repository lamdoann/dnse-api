/**
 * Public market-data example — no credentials required.
 *
 *   npx ts-node examples/rest-public.ts
 */
import { RestClient } from '../src';

async function main() {
  const client = new RestClient();

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
