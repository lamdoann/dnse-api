/**
 * Realtime trading & account streams qua WebSocket OpenAPI.
 * Dùng chính API key/secret (không cần login riêng).
 *
 *   DNSE_API_KEY=... DNSE_API_SECRET=... npx ts-node examples/ws-trading.ts
 *
 * Nhận cập nhật realtime khi lệnh/vị thế/tài sản thay đổi — hữu ích để theo dõi
 * fill, hủy, khớp một phần… mà không cần polling REST.
 */
import { WebsocketClient } from '../src';

async function main() {
  const ws = new WebsocketClient({
    apiKey: process.env.DNSE_API_KEY!,
    apiSecret: process.env.DNSE_API_SECRET!,
  });

  ws.on('open', () => {
    console.log('Đã kết nối & xác thực — subscribe trading streams...');
    ws.subscribeOrders(); // cập nhật lệnh
    ws.subscribePositions(); // thay đổi vị thế
    ws.subscribeAccount(); // biến động tài sản/tiền
    ws.subscribeOrderEvent('STOCK'); // sự kiện lệnh (cơ sở)
    ws.subscribeOrderEvent('DERIVATIVE'); // sự kiện lệnh (phái sinh)
    ws.subscribePositionEvent('DERIVATIVE'); // sự kiện vị thế phái sinh
  });

  ws.on('order_event', (m) => console.log('ORDER   ', m.data));
  ws.on('position_event', (m) => console.log('POSITION', m.data));
  ws.on('account', (m) => console.log('ACCOUNT ', m.data));

  // Bắt tất cả để quan sát:
  // ws.on('message', (m) => console.log(m.type, m.data));

  ws.on('reconnected', () => console.log('reconnected — đã re-subscribe'));
  ws.on('error', (err) => console.error('ws error:', err.message));
  ws.on('close', () => console.log('closed'));

  ws.connect();

  setTimeout(() => ws.close().then(() => process.exit(0)), 60_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
