# CLAUDE.md

Ngữ cảnh dự án cho Claude Code. **Khi có thay đổi đáng kể (thêm endpoint, đổi
kiến trúc, đổi lệnh build, xác nhận được thông tin `VERIFY`…), cập nhật lại file
này.**

## Dự án là gì

`dnse-api` — SDK Node.js & TypeScript cho **DNSE OpenAPI** (chứng khoán VN):
tài khoản, đặt lệnh, vị thế, dữ liệu thị trường (REST) + market data realtime
(WebSocket OpenAPI). Kiến trúc mô phỏng theo
[`tiagosiebler/binance`](https://github.com/tiagosiebler/binance): một lớp
`BaseRestClient` trừu tượng lo ký request, các client cụ thể chỉ khai báo
endpoint đã gõ kiểu. Auth port từ [SDK chính thức DNSE](https://github.com/dnse-tech/openapi-sdk/tree/main/javascript).

- Remote: <https://github.com/lamdoann/dnse-api>
- Node.js >= 18. Ngôn ngữ: TypeScript (strict).

## Lệnh thường dùng

```bash
npm install
npm run build      # tsc -> dist/   (KHÔNG phải lib/)
npm test           # jest: test ký HMAC REST + WS (hiện 20 test)
npm run lint       # eslint src
npm run clean      # rimraf dist
```

- Output build ra **`dist/`** (config ở `tsconfig.json` → `outDir`). `dist/` được
  gitignore; chỉ commit `src/`. Gói npm chỉ đóng `dist/` (`package.json` → `files`).
- Chỉ ship CommonJS. ESM vẫn `import` được nhờ Node đọc named export từ CJS.

## Auth — CHỈ dùng OpenAPI (HMAC), KHÔNG dùng Entrade

Toàn bộ thư viện thuần **DNSE OpenAPI**, xác thực bằng **HMAC api-key/secret**:

- **REST** (`openapi.dnse.com.vn`) → `RestClient`. Ký HMAC HTTP-signature
  (draft-cavage). **Mọi endpoint đều cần key & được ký** — kể cả dữ liệu giá
  (OHLC, secdef); gọi không key → `401 X-API-Key header required`. Không có REST
  endpoint public.
- **Realtime** (`wss://ws-openapi.dnse.com.vn/v1/stream?encoding=json`) →
  `WebsocketClient` (alias cũ: `MarketDataWsClient`). WebSocket **thuần** (lib
  `ws`), frame JSON. Auth handshake gửi
  `{action:"auth", api_key, signature, timestamp, nonce}`, ký
  `HMAC-SHA256(secret, "{apiKey}:{timestamp}:{nonce}")` dạng **hex** — **dùng
  cùng key/secret với REST**, KHÔNG cần login/JWT. Xử lý cả market data lẫn
  trading/tài khoản (orders/positions/account/order_event/position_event).

LƯU Ý LỊCH SỬ: từng có bản dùng MQTT + JWT (hệ EntradeX/LightSpeed cũ) — đã bỏ
hẳn vì OpenAPI có feed realtime riêng bằng chính key/secret. Đừng tái introduce
Entrade/MQTT trừ khi có lý do rõ ràng.

## Kiến trúc mã nguồn

```
src/
├── index.ts                 # public exports
├── RestClient.ts            # client REST chính (endpoint đã typed)
├── WebsocketClient.ts       # realtime WS OpenAPI: market data + trading (lib ws)
├── types/                   # request/response types theo domain
│   ├── shared.ts            # enum: MarketType, OrderSide, OrderType, OtpType…
│   ├── ws.ts                # MarketDataWsOptions, channel/message/event, boards
│   ├── client.ts · account.ts · order.ts · market.ts · auth.ts
│   └── index.ts
└── util/
    ├── BaseRestClient.ts    # trừu tượng: ký + axios + get/post/…Private
    ├── node-support.ts      # HMAC signing REST (base64) + WS (hex) (crypto)
    ├── requestUtils.ts      # serialise params, fill path params
    ├── DNSEAPIError.ts      # lỗi chuẩn hóa
    └── logger.ts            # logger cắm được
```

## Cách ký request (HMAC — draft-cavage)

Signing string cho request private (ĐÃ VERIFY LIVE):
```
(request-target): <method> <path>      # PATH ONLY — KHÔNG kèm query string!
date: <RFC-1123 date>
nonce: <nonce>                          # nếu hmacNonceEnabled (mặc định true)
```
→ HMAC-SHA256(secret, string) → base64 → URL-encode.

Gắn header:
- `Date`, `x-api-key`
- `X-Signature: Signature keyId="..",algorithm="..",headers="(request-target) date",signature=".."[,nonce=".."]`

Các điểm SỐNG CHẾT (sai là `400 OA-400 Authorization field missing/malformed`):
- Giá trị `X-Signature` phải có tiền tố **`Signature `** (có dấu cách).
- `headers="(request-target) date"` **luôn cố định** (nonce KHÔNG nằm trong list
  này, dù nonce có trong signing string).
- **KHÔNG** gửi header `Nonce` riêng; nonce chỉ nằm cuối giá trị `X-Signature`.
- Request-target ký **chỉ path, bỏ query** (query vẫn gửi trong URL thật).

Toàn bộ ở `util/node-support.ts` + `util/BaseRestClient.ts`.

## Quy ước & cách mở rộng

- **Thêm REST endpoint**: thêm 1 method vào `RestClient` gọi
  `getPrivate/postPrivate/putPrivate/deletePrivate` (private, tự ký) hoặc
  `get/post/…` (public), dùng `fillPathParams` cho `{placeholder}`; khai báo
  type request/response ở `src/types/*` và export qua `types/index.ts`.
- **Path REST** lấy đúng theo SDK chính thức (vd `/accounts`, `/price/ohlc`,
  `/registration/trading-token`) — đừng tự chế prefix service.
- **Lệnh ghi (đặt/sửa/hủy/đóng vị thế)** cần `tradingToken` truyền qua
  `options.tradingToken`; lấy token qua `sendEmailOtp` → `createTradingToken`.
- **`dryRun`** (toàn cục hoặc từng call) trả về mô tả request thay vì gọi mạng —
  dùng để test/inspect. Test dựa nhiều vào cái này.
- **Lỗi** luôn chuẩn hóa thành `DNSEAPIError` (`status`, `body`, `request`).
- **WS**: subscribe qua helper hoặc `subscribeChannel(spec)` thô. Channel name
  `<type>.<param>.json`. ĐỦ BỘ market data: `ohlc` / `ohlc_closed`
  (`.{resolution}`), `tick` / `tick_extra` / `top_price` / `expected_price` /
  `security_definition` (`.{board}`, mặc định `DEFAULT_BOARDS`), `market_index`
  / `estimated_market_index` (`.{index}`), `foreign` (`.{board}`, mặc định
  `*`), `session` (`.{productGroupId}.{board}`, board mặc định `*`).
  Tự reconnect → re-auth → re-subscribe; route theo field `T`; phát `message`
  + event theo type. Chỉ encoding JSON.
- Resolution hợp lệ (VERIFY LIVE): `1,3,5,15,30,1H,1D,1W`. `60`, `1M`, `D` trả
  RỖNG — đừng dùng.
- WS: kết nối tối đa 8 giờ; server gửi PING mỗi 3 phút, client phải PONG trong
  1 phút (client đã tự xử lý). Symbol phải VIẾT HOA.

## Điểm chưa chốt

- REST + WS market data ĐÃ CHẠY LIVE OK (getAccounts/getInstruments/getOhlc,
  WS ohlc/quote/trade/market_index). Trading writes (đặt lệnh) chưa test live
  (cần trading-token/OTP).
- Payload WS đã gõ kiểu ở `types/ws.ts`: `OhlcData`/`QuoteData`/`TradeData`/
  `MarketIndexData` theo WIRE THẬT (lưu ý: trade dùng `matchPrice`/`matchQtty`,
  `time` là object `{Seconds,Nanos}` = `WsTimestamp`, quote bid/offer =
  `PriceLevel{price,qtty}`). secdef/order/position/account gõ theo models.py,
  đánh dấu ⚠️ chưa verify wire. Mọi payload có `[key:string]:unknown` nên field
  lạ không vỡ. Per-type event trả `MarketDataMessage<T>` đúng kiểu.
- DẠNG MÃ theo kênh (ĐÃ VERIFY LIVE): kênh **ohlc** khớp theo **ticker**
  (`symbolType`, vd `VN30F1M`); kênh **tick/quote/secdef** khớp theo **mã KRX**
  (`symbol`, vd `41I1G8000`). Cổ phiếu thì hai mã trùng nhau nên không lộ; phái
  sinh thì KHÁC → phải subscribe đúng dạng. Trade/quote phái sinh về trên board
  `G1` (đã có trong `DEFAULT_BOARDS`) — trước tưởng sai board, thực ra sai mã.
  Xem `examples/derivatives-realtime.ts` (map KRX↔ticker).
- Encoding: chỉ JSON. Msgpack đã quyết **không làm** (JSON đủ) — đừng thêm lại
  trừ khi user yêu cầu.

## Trạng thái hiện tại

- REST: đầy đủ endpoint theo SDK gốc (accounts, balances, loan packages, ppse,
  positions, orders read/write, history, corporate actions, instruments, OHLC,
  secdef, OTP → trading token). `getInstruments` = `GET /instruments` (query:
  symbol/marketId/securityGroupId/indexName/limit/page), trả `{ data: [...] }`.
  Instrument: `symbol` = mã KRX (vd `41I1G8000`), `symbolType` = ticker quen
  thuộc (vd `VN30F1M`, dùng cái này cho OHLC/WS). Phái sinh = `marketId "DVX"`
  hoặc `securityGroupId "FU"` (xem `examples/derivatives-realtime.ts`).
- OHLC: resolution ngày là **`1D`** (không phải `D`), phút là `1/3/5/15/30/60`.
  LƯU Ý ĐƠN VỊ: `price` cổ phiếu tính bằng **nghìn VND** (HPG 20.65 = 20,650đ),
  volume = số cổ phiếu; phái sinh `price` là **điểm chỉ số**, volume = số hợp
  đồng (VN30F ×100,000đ/điểm). Từng cân nhắc thêm field `turnover` nhưng đã BỎ
  vì volume×price không ra VND thẳng (đơn vị khác nhau theo instrument) → dễ
  hiểu nhầm. Đừng tự thêm lại trừ khi có quy đổi đơn vị rõ ràng.
- Message `trade` có sẵn `grossTradeAmount` = tổng giá trị giao dịch **lũy kế**
  trong phiên, đơn vị **tỷ VND** (verify live: HPG 0.31 = 0.313 tỷ; VN30F1M
  19,660 = notional 19,717 tỷ, đã tính multiplier 100,000). Lũy kế nên muốn giá
  trị 1 khoảng thì lấy hiệu. Dùng cái này thay vì tự tính turnover.
- WS: `WebsocketClient` thuần OpenAPI (ws + HMAC handshake) — market data
  (ohlc/quote/trade/secdef/market_index) + trading/tài khoản (orders/positions/
  account/order_event/position_event, có bản broker.*). Có test.
- 22/22 test pass. Build sạch ra `dist/`.
