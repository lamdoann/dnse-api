/**
 * Realtime market data over MQTT/WebSocket.
 *
 *   DNSE_USERNAME=... DNSE_PASSWORD=... npx ts-node examples/ws-market-data.ts
 *
 * Or pass an existing JWT directly:
 *   DNSE_INVESTOR_ID=... DNSE_TOKEN=... npx ts-node examples/ws-market-data.ts
 */
import {
  EntradeAuthClient,
  MarketDataWsClient,
  Topics,
} from '../src';

async function main() {
  // --- 1) Obtain JWT credentials --------------------------------------
  let investorId = process.env.DNSE_INVESTOR_ID;
  let token = process.env.DNSE_TOKEN;

  if (!investorId || !token) {
    const auth = new EntradeAuthClient();
    ({ investorId, token } = await auth.authenticate(
      process.env.DNSE_USERNAME!,
      process.env.DNSE_PASSWORD!,
    ));
    console.log('Authenticated as investor', investorId);
  }

  // --- 2) Connect & subscribe -----------------------------------------
  const ws = new MarketDataWsClient({ investorId, token });

  ws.on('open', () => {
    console.log('Connected — subscribing...');
    ws.subscribe([
      Topics.stockInfo('HPG'),
      Topics.topPrice('HPG'),
      Topics.marketIndex('VNINDEX'),
    ]);
  });

  ws.on('message', (msg) => {
    console.log(`[${msg.topic}]`, msg.data);
  });

  ws.on('reconnect', () => console.log('reconnecting...'));
  ws.on('error', (err) => console.error('ws error:', err.message));
  ws.on('close', () => console.log('closed'));

  ws.connect();

  // Stop after 60s for the demo.
  setTimeout(() => ws.close().then(() => process.exit(0)), 60_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
