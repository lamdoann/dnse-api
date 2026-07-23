/**
 * Fetch nến (OHLC) của hợp đồng tương lai VN30.
 * Cần API key/secret (OpenAPI ký mọi request, kể cả dữ liệu giá).
 *
 *   DNSE_API_KEY=... DNSE_API_SECRET=... npx ts-node examples/rest-ohlc-vn30-futures.ts
 *
 * Mã phái sinh VN30 (chọn 1):
 *   VN30F1M  - tháng gần nhất (front month)   ← dùng mặc định
 *   VN30F2M  - tháng kế tiếp
 *   VN30F1Q  - quý gần nhất
 *   VN30F2Q  - quý kế tiếp
 *   VN30F2508 - hợp đồng cụ thể (VN30F + YYMM, vd tháng 08/2025)
 */
import { RestClient, OhlcResponse } from '../src';

const SYMBOL = process.env.SYMBOL || 'VN30F1M';

async function main() {
  const client = new RestClient({
    apiKey: process.env.DNSE_API_KEY,
    apiSecret: process.env.DNSE_API_SECRET,
  });

  const now = Math.floor(Date.now() / 1000);
  const from = now - 7 * 24 * 60 * 60; // 7 ngày gần nhất

  // market = 'DERIVATIVE' cho hợp đồng tương lai; resolution '1D' = nến ngày.
  const ohlc = (await client.getOhlc('DERIVATIVE', {
    symbol: SYMBOL,
    resolution: 'D',
    from,
    to: now,
  })) as OhlcResponse;

  if (!ohlc.t || ohlc.t.length === 0) {
    console.log(`Không có dữ liệu cho ${SYMBOL} (status=${ohlc.s ?? 'n/a'}).`);
    return;
  }

  // DNSE trả về mảng song song t/o/h/l/c/v (kiểu TradingView) — ghép lại thành nến.
  const candles = ohlc.t.map((t, i) => ({
    time: new Date(t * 1000).toISOString().slice(0, 10),
    open: ohlc.o[i],
    high: ohlc.h[i],
    low: ohlc.l[i],
    close: ohlc.c[i],
    volume: ohlc.v[i],
  }));

  console.log(`Nến ngày ${SYMBOL} (${candles.length} phiên):`);
  console.table(candles);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
