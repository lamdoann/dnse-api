/**
 * Sample: realtime cho TẤT CẢ symbol phái sinh.
 *
 *   1) Fetch tất cả instrument, lọc ra symbol phái sinh.
 *   2) Subscribe trades (tick) cho mỗi symbol phái sinh.
 *   3) Subscribe candlestick (OHLC) cho mỗi symbol phái sinh.
 *
 *   DNSE_API_KEY=... DNSE_API_SECRET=... npx ts-node examples/derivatives-realtime.ts
 *
 * Ghi chú: OpenAPI không có enum công khai để lọc "phái sinh" ở server, nên ta
 * fetch danh sách rồi lọc CLIENT-SIDE cho chắc (theo securityType/securityGroupId
 * hoặc pattern mã HĐTL như VN30F1M, VN30F2508, GB05F…). Chỉnh `isDerivative`
 * nếu tài khoản của bạn trả về field khác.
 */
import { RestClient, WebsocketClient, Instrument } from '../src';

const OHLC_RESOLUTION = '1'; // nến 1 phút

/** Heuristic nhận biết mã phái sinh (futures) từ 1 instrument. */
function isDerivative(inst: Instrument): boolean {
  const group = String(inst.securityGroupId ?? '').toUpperCase();
  const type = String(inst.securityType ?? '').toUpperCase();
  // KRX/DNSE thường dùng "FU" (futures) cho phái sinh.
  if (group === 'FU' || type.includes('FUTURE')) return true;
  // Fallback theo pattern mã: VN30F1M / VN30F2508 / GB05F… (…F + số).
  return /F(\d{2,}|1M|2M|1Q|2Q)$/.test(inst.symbol);
}

/** Chuẩn hóa response /instruments về mảng Instrument (có thể bị wrap). */
function toInstrumentList(res: unknown): Instrument[] {
  if (Array.isArray(res)) return res as Instrument[];
  const wrapped = res as { instruments?: Instrument[] };
  return wrapped.instruments ?? [];
}

async function main() {
  const rest = new RestClient({
    apiKey: process.env.DNSE_API_KEY,
    apiSecret: process.env.DNSE_API_SECRET,
  });

  // --- 1) Fetch all symbols phái sinh ---------------------------------
  const res = await rest.getInstruments({ limit: 1000 });
  const all = toInstrumentList(res);
  const derivatives = all.filter(isDerivative);
  const symbols = derivatives.map((d) => d.symbol);

  if (symbols.length === 0) {
    console.error(
      'Không tìm thấy symbol phái sinh. In thử vài instrument để chỉnh isDerivative():',
    );
    console.error(all.slice(0, 5));
    process.exit(1);
  }
  console.log(`Tìm thấy ${symbols.length} mã phái sinh:`, symbols.join(', '));

  // --- 2) & 3) Subscribe trades + candlestick cho mỗi symbol ----------
  const ws = new WebsocketClient({
    apiKey: process.env.DNSE_API_KEY!,
    apiSecret: process.env.DNSE_API_SECRET!,
  });

  ws.on('open', () => {
    console.log('WS đã kết nối & xác thực — subscribe...');
    ws.subscribeTrade(symbols); // 2) tick khớp lệnh cho mỗi mã
    ws.subscribeOhlc(symbols, OHLC_RESOLUTION); // 3) nến cho mỗi mã
    console.log(`Đã subscribe trade + ohlc(${OHLC_RESOLUTION}) cho ${symbols.length} mã.`);
  });

  ws.on('trade', (m) => console.log('TRADE', m.data));
  ws.on('ohlc', (m) => console.log('OHLC ', m.data));

  ws.on('reconnected', () => console.log('reconnected — đã re-subscribe'));
  ws.on('error', (err) => console.error('ws error:', err.message));
  ws.on('close', () => console.log('closed'));

  ws.connect();

  // Demo: dừng sau 60s.
  setTimeout(() => ws.close().then(() => process.exit(0)), 60_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
