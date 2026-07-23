# CLAUDE.md

Ngữ cảnh dự án cho Claude Code. **Khi có thay đổi đáng kể (thêm endpoint, đổi
kiến trúc, đổi lệnh build, xác nhận được thông tin `VERIFY`…), cập nhật lại file
này.**

## Dự án là gì

`dnse-api` — SDK Node.js & TypeScript cho **DNSE OpenAPI** (chứng khoán VN):
tài khoản, đặt lệnh, vị thế, dữ liệu thị trường (REST) + market data realtime
(MQTT/WebSocket). Kiến trúc mô phỏng theo
[`tiagosiebler/binance`](https://github.com/tiagosiebler/binance): một lớp
`BaseRestClient` trừu tượng lo ký request, các client cụ thể chỉ khai báo
endpoint đã gõ kiểu. Auth port từ [SDK chính thức DNSE](https://github.com/dnse-tech/openapi-sdk/tree/main/javascript).

- Remote: <https://github.com/lamdoann/dnse-api>
- Node.js >= 18. Ngôn ngữ: TypeScript (strict).

## Lệnh thường dùng

```bash
npm install
npm run build      # tsc -> dist/   (KHÔNG phải lib/)
npm test           # jest: test ký HMAC + WS (hiện 16 test)
npm run lint       # eslint src
npm run clean      # rimraf dist
```

- Output build ra **`dist/`** (config ở `tsconfig.json` → `outDir`). `dist/` được
  gitignore; chỉ commit `src/`. Gói npm chỉ đóng `dist/` (`package.json` → `files`).
- Chỉ ship CommonJS. ESM vẫn `import` được nhờ Node đọc named export từ CJS.

## Hai lớp API (QUAN TRỌNG — auth khác nhau)

1. **OpenAPI** (`openapi.dnse.com.vn`) — dùng cho `RestClient`. Auth = **HMAC
   HTTP-signature** (api-key + secret). Đây là phần chính, đã build đầy đủ.
2. **LightSpeed / EntradeX** — dùng cho market data realtime. Auth = **JWT**
   (`investorId` + `token`), lấy qua `EntradeAuthClient`. KHÁC hoàn toàn HMAC.

## Kiến trúc mã nguồn

```
src/
├── index.ts                 # public exports
├── RestClient.ts            # client REST chính (endpoint đã typed)
├── MarketDataWsClient.ts    # realtime MQTT/WebSocket (EventEmitter)
├── EntradeAuthClient.ts     # helper login lấy JWT cho WS
├── types/                   # request/response types theo domain
│   ├── shared.ts            # enum: MarketType, OrderSide, OrderType, OtpType…
│   ├── client.ts · ws.ts · account.ts · order.ts · market.ts · auth.ts
│   └── index.ts
└── util/
    ├── BaseRestClient.ts    # trừu tượng: ký + axios + get/post/…Private
    ├── node-support.ts      # HMAC signing (crypto)
    ├── topics.ts            # builder topic MQTT
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
- **WS**: `subscribe()` nhận topic string thô hoặc builder trong `util/topics.ts`;
  tự reconnect + re-subscribe; phát event `message` + event theo tên topic.

## Điểm CHƯA verify (đánh dấu `VERIFY` trong code)

Docs LightSpeed/MQTT của DNSE trên GitBook render JS nên chưa xác thực tự động:
1. **Topic strings KRX** trong `util/topics.ts` — theo convention
   `plaintext/quotes/...`; đối chiếu lại docs live nếu subscribe không ra dữ liệu.
2. **Endpoint login** trong `EntradeAuthClient` (`/user-service/api/auth`,
   `/user-service/api/me`) — theo flow EntradeX phổ biến; chỉnh nếu gateway khác.

Khi xác nhận được thông tin thật → sửa code, bỏ chú thích `VERIFY`, và cập nhật
mục này + README.

## Trạng thái hiện tại

- REST: đầy đủ endpoint theo SDK gốc (accounts, balances, loan packages, ppse,
  positions, orders read/write, history, corporate actions, OHLC, secdef, OTP →
  trading token).
- WS: `MarketDataWsClient` + `EntradeAuthClient` + topic builders — xong, có test.
- 16/16 test pass. Build sạch ra `dist/`.
