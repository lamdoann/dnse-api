/**
 * Realtime market data qua WebSocket OpenAPI — dùng chính API key/secret.
 *
 *   DNSE_API_KEY=... DNSE_API_SECRET=... npx ts-node examples/ws-market-data.ts
 *
 * Không cần login/JWT riêng — feed realtime ký HMAC bằng cùng cặp key/secret
 * như REST.
 */
import { WebsocketClient } from '../src';

async function main() {
  const ws = new WebsocketClient({
    apiKey: process.env.DNSE_API_KEY!,
    apiSecret: process.env.DNSE_API_SECRET!,
  });

  ws.on('open', () => {
    console.log('Đã kết nối & xác thực — subscribe...');
    ws.subscribeOhlc(['VN30F1M', 'SSI'], '1'); // nến 1 phút
    ws.subscribeQuote(['VN30F1M']); // bid/ask
    ws.subscribeMarketIndex(['VNINDEX', 'VN30']); // chỉ số
  });

  ws.on('ohlc', (m) => console.log('OHLC   ', m.data));
  ws.on('quote', (m) => console.log('QUOTE  ', m.data));
  ws.on('market_index', (m) => console.log('INDEX  ', m.data));

  // Hoặc nghe tất cả:
  // ws.on('message', (m) => console.log(m.type, m.data));

  ws.on('reconnect', () => console.log('reconnecting...'));
  ws.on('reconnected', () => console.log('reconnected'));
  ws.on('error', (err) => console.error('ws error:', err.message));
  ws.on('close', () => console.log('closed'));

  ws.connect();

  setTimeout(() => ws.close().then(() => process.exit(0)), 60_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
