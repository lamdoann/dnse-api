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

Signing string cho request private:
```
(request-target): <method> <path?query>
date: <RFC-1123 date>
nonce: <nonce>            # nếu hmacNonceEnabled (mặc định true)
```
→ HMAC-SHA256(secret, string) → base64 → URL-encode. Gắn header `Date`,
`x-api-key`, `X-Signature` (keyId/algorithm/headers/nonce/signature), `Nonce`.
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
- **WS**: subscribe qua helper (`subscribeOhlc/Quote/Trade/SecDef/MarketIndex`)
  hoặc `subscribeChannel(spec)` thô. Channel name: `<type>.<param>.json` (ohlc
  dùng resolution; trade/quote/secdef dùng board, mặc định toàn bộ
  `DEFAULT_BOARDS`; market_index dùng mã chỉ số). Tự reconnect → re-auth →
  re-subscribe; message route theo field `T`; phát `message` + event theo type.
  Hiện chỉ encoding JSON (msgpack chưa làm).

## Điểm chưa chốt

- Protocol WS đã verify theo SDK Python chính thức (`dnse-tech/openapi-sdk`,
  thư mục `python/dnse/websocket/` + `python/websocket-marketdata|trading/`).
  Chưa chạy live với key thật.
- Encoding msgpack chưa hỗ trợ (mới JSON).

## Trạng thái hiện tại

- REST: đầy đủ endpoint theo SDK gốc (accounts, balances, loan packages, ppse,
  positions, orders read/write, history, corporate actions, instruments, OHLC,
  secdef, OTP → trading token). `getInstruments` = `GET /instruments` (query:
  symbol/marketId/securityGroupId/indexName/limit/page) — dùng để liệt kê mã;
  DNSE không có enum public cho "phái sinh" nên lọc client-side (xem
  `examples/derivatives-realtime.ts`).
- WS: `WebsocketClient` thuần OpenAPI (ws + HMAC handshake) — market data
  (ohlc/quote/trade/secdef/market_index) + trading/tài khoản (orders/positions/
  account/order_event/position_event, có bản broker.*). Có test.
- 22/22 test pass. Build sạch ra `dist/`.
