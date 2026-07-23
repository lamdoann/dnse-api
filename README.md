# dnse-api

> SDK Node.js & TypeScript cho **DNSE OpenAPI** — tài khoản, đặt lệnh, vị thế và dữ liệu thị trường, với ký HMAC HTTP-signature tự động.

- 📚 Tài liệu DNSE: <https://developers.dnse.com.vn/docs/guide/intro/api_platform>
- 🔐 Xác thực: API key/secret + HMAC HTTP-signature, OTP → trading token để giao dịch
- 📡 Dữ liệu thị trường realtime qua WebSocket OpenAPI (`MarketDataWsClient`, cùng key/secret)
- 🧪 Full TypeScript, có `dryRun` để xem trước request trước khi gửi thật
- ✅ Hỗ trợ cả CommonJS (`require`) và ESM (`import`)

---

## Cài đặt

```bash
npm install dnse-api
# yêu cầu Node.js >= 18
```

## Khởi tạo client

```ts
import { RestClient } from 'dnse-api';

const client = new RestClient({
  apiKey: process.env.DNSE_API_KEY,       // tạo tại developers.dnse.com.vn
  apiSecret: process.env.DNSE_API_SECRET, // dùng để ký HMAC, không bao giờ gửi lên server
  // baseUrl: 'https://openapi.dnse.com.vn',  // mặc định
  // algorithm: 'hmac-sha256',                // hmac-sha256 | hmac-sha384 | hmac-sha512
  // hmacNonceEnabled: true,                  // thêm nonce chống replay
  // dryRun: false,                           // true = in request thay vì gửi
});
```

> Lưu ý: OpenAPI ký **mọi** request (kể cả dữ liệu giá OHLC / security
> definition), nên đều cần `apiKey` + `apiSecret`. Không có endpoint REST public.

## Dùng nhanh

```ts
// Dữ liệu thị trường (cũng cần key — OpenAPI ký mọi request)
const ohlc = await client.getOhlc('STOCK', {
  symbol: 'HPG',
  resolution: '1',
  from: 1735689600,
  to: 1735776000,
});

// Tài khoản (private — tự động ký)
const accounts = await client.getAccounts();
const accountNo = accounts.accounts[0].accountNo;

const balances = await client.getBalances(accountNo);
const positions = await client.getPositions(accountNo, { marketType: 'STOCK' });
```

## Đặt lệnh (cần trading token)

Mọi lệnh ghi (đặt/sửa/hủy/đóng vị thế) cần một **trading token** ngắn hạn, lấy từ OTP:

```ts
// 1) Gửi OTP qua email (hoặc dùng Smart OTP trên app)
await client.sendEmailOtp({ email: 'you@example.com' });

// 2) Đổi mã OTP lấy trading token
const { tradingToken } = await client.createTradingToken({
  otpType: 'email',
  passcode: '123456',
});

// 3) Đặt lệnh, truyền token qua options
const order = await client.placeOrder(
  'STOCK',
  {
    accountNo: '0001000115',
    symbol: 'HPG',
    side: 'BUY',
    orderType: 'LO',
    price: 25950,
    quantity: 100,
    loanPackageId: 2396,
  },
  { tradingToken },
);
```

## Chế độ `dryRun`

Bật `dryRun` (toàn cục hoặc theo từng call) để xem chính xác request sẽ gửi — kèm header đã ký — mà **không** gọi mạng:

```ts
const preview = await client.placeOrder('STOCK', payload, {
  tradingToken,
  dryRun: true,
});
// => { dryRun: true, method, url, headers, body }
```

## Xử lý lỗi

Mọi lỗi HTTP được chuẩn hóa thành `DNSEAPIError`:

```ts
import { DNSEAPIError } from 'dnse-api';

try {
  await client.getBalances('0001000115');
} catch (err) {
  if (err instanceof DNSEAPIError) {
    console.error(err.status, err.body, err.request);
  }
}
```

---

## API đã hỗ trợ

### Xác thực
| Method | Mô tả | Endpoint |
| --- | --- | --- |
| `sendEmailOtp(params)` | Gửi OTP qua email | `POST /registration/send-email-otp` |
| `createTradingToken(params)` | Đổi OTP lấy trading token | `POST /registration/trading-token` |

### Tài khoản
| Method | Mô tả | Endpoint |
| --- | --- | --- |
| `getAccounts()` | Danh sách tiểu khoản | `GET /accounts` |
| `getBalances(accountNo)` | Số dư tiền & tài sản | `GET /accounts/{accountNo}/balances` |
| `getLoanPackages(accountNo, params?)` | Gói vay theo mã | `GET /accounts/{accountNo}/loan-packages` |
| `getPpse(accountNo, params)` | Sức mua/bán | `GET /accounts/{accountNo}/ppse` |
| `getCorporateActionHistory(accountNo, params?)` | Lịch sử sự kiện quyền | `GET /accounts/{accountNo}/corporate-action-history` |

### Vị thế & lệnh (đọc)
| Method | Mô tả | Endpoint |
| --- | --- | --- |
| `getPositions(accountNo, params)` | Danh mục đang nắm giữ | `GET /accounts/{accountNo}/positions` |
| `getOrders(accountNo, marketType)` | Sổ lệnh trong ngày | `GET /accounts/{accountNo}/orders` |
| `getOrderDetail(accountNo, orderId, params)` | Chi tiết 1 lệnh | `GET /accounts/{accountNo}/orders/{orderId}` |
| `getExecutionDetail(accountNo, orderId, params)` | Lịch sử khớp/khớp một phần | `GET /accounts/{accountNo}/executions/{orderId}` |
| `getOrderHistory(accountNo, params?)` | Lịch sử lệnh (tối đa 1 năm) | `GET /accounts/{accountNo}/orders/history` |

### Lệnh (ghi — cần trading token)
| Method | Mô tả | Endpoint |
| --- | --- | --- |
| `placeOrder(marketType, payload, opts)` | Đặt lệnh mới | `POST /accounts/orders` |
| `amendOrder(accountNo, orderId, marketType, payload, opts)` | Sửa lệnh | `PUT /accounts/{accountNo}/orders/{orderId}` |
| `cancelOrder(accountNo, orderId, marketType, opts)` | Hủy lệnh | `DELETE /accounts/{accountNo}/orders/{orderId}` |
| `closePosition(accountNo, positionId, marketType, payload, opts)` | Đóng vị thế | `POST /accounts/{accountNo}/positions/{positionId}/close` |

### Dữ liệu thị trường (cần key)
| Method | Mô tả | Endpoint |
| --- | --- | --- |
| `getSecurityDefinition(symbol, params?)` | Thông tin mã (trần/sàn/lô…) | `GET /price/{symbol}/secdef` |
| `getOhlc(market, params)` | Nến OHLC | `GET /price/ohlc` |

---

## Cách ký request (HMAC HTTP-signature)

Mỗi request private được ký theo lược đồ draft-cavage mà DNSE dùng:

```
signing string:
  (request-target): <method> <path?query>
  date: <RFC-1123 date>
  nonce: <nonce>           # nếu bật

→ HMAC-SHA256(secret, signing string) → base64 → URL-encode
```

Và gắn các header:

```
Date: Fri, 26 Jun 2026 16:08:17 GMT
x-api-key: <apiKey>
X-Signature: keyId="<apiKey>",algorithm="hmac-sha256",headers="(request-target) date nonce",nonce="...",signature="..."
Nonce: <nonce>
```

Toàn bộ logic này nằm trong [`src/util/node-support.ts`](src/util/node-support.ts) và [`src/util/BaseRestClient.ts`](src/util/BaseRestClient.ts).

---

## Dữ liệu thị trường realtime (WebSocket)

DNSE OpenAPI có feed realtime **WebSocket thuần** tại `wss://ws-openapi.dnse.com.vn`, payload **JSON**. Xác thực bằng **handshake HMAC dùng chính `apiKey`/`apiSecret`** như REST — **không** cần login/JWT riêng.

### Kết nối & subscribe

```ts
import { MarketDataWsClient } from 'dnse-api';

const ws = new MarketDataWsClient({ apiKey, apiSecret });

ws.on('open', () => {
  ws.subscribeOhlc(['VN30F1M', 'SSI'], '1'); // nến 1 phút
  ws.subscribeQuote(['VN30F1M']);            // bid/ask (top of book)
  ws.subscribeTrade(['HPG']);                // tick khớp lệnh
  ws.subscribeMarketIndex(['VNINDEX', 'VN30']);
});

ws.on('ohlc', (m) => console.log(m.data));
ws.on('quote', (m) => console.log(m.data));
ws.on('market_index', (m) => console.log(m.data));
// hoặc nghe tất cả:
ws.on('message', (m) => console.log(m.type, m.data));

ws.on('reconnect', () => {});
ws.on('reconnected', () => {});
ws.on('error', (err) => console.error(err));
ws.on('close', () => {});

ws.connect();
// ws.unsubscribe('ohlc.1.json');
// await ws.close();
```

Điểm chính:
- Handshake auth: gửi `{action:"auth", api_key, signature, timestamp, nonce}`, ký `HMAC-SHA256(secret, "{apiKey}:{timestamp}:{nonce}")` (hex). Chờ `auth_success` mới subscribe.
- Tự **reconnect** (backoff) → re-auth → **re-subscribe** lại toàn bộ channel.
- Message phát ở event `message` (kèm `type`, `data`) và event theo từng loại (`ohlc`/`quote`/`trade`/`market_index`/`security_definition`).

### Các method subscribe

| Method | Channel | Dữ liệu |
| --- | --- | --- |
| `subscribeOhlc(symbols, resolution)` | `ohlc.{resolution}.json` | Nến realtime |
| `subscribeQuote(symbols, boards?)` | `top_price.{board}.json` | Sổ lệnh bid/ask |
| `subscribeTrade(symbols, boards?)` | `tick.{board}.json` | Tick khớp lệnh |
| `subscribeSecDef(symbols, boards?)` | `security_definition.{board}.json` | Định nghĩa mã |
| `subscribeMarketIndex(indices)` | `market_index.{index}.json` | Chỉ số (VNINDEX, VN30…) |
| `subscribeChannel(spec)` | *(bất kỳ)* | Escape hatch cho channel thô |

`boards` mặc định là toàn bộ bảng KRX (`G1,G3,G4,G7,T1,T2,T3,T4,T6`) — truyền mảng để thu hẹp. Message route theo field `T` (t=trade, q=quote, b=ohlc, mi=market_index, sd=security_definition…).

---

## Kiến trúc

```
src/
├── index.ts                 # public exports
├── RestClient.ts            # client REST chính, khai báo endpoint đã typed
├── MarketDataWsClient.ts    # client realtime WebSocket OpenAPI (EventEmitter)
├── types/                   # request/response types theo domain
│   ├── shared.ts            # enum: MarketType, OrderSide, OrderType...
│   ├── client.ts            # RestClientOptions, RequestOptions, credentials
│   ├── ws.ts                # MarketDataWsOptions, channel & event types
│   ├── account.ts · order.ts · market.ts · auth.ts
│   └── index.ts
└── util/
    ├── BaseRestClient.ts    # lớp trừu tượng: ký + axios + get/post/...Private
    ├── node-support.ts      # HMAC signing REST + WS (crypto)
    ├── requestUtils.ts      # serialise params, fill path params
    ├── DNSEAPIError.ts      # lỗi chuẩn hóa
    └── logger.ts            # logger cắm được (pluggable)
```

Muốn thêm endpoint mới: thêm 1 method vào `RestClient` gọi `getPrivate/postPrivate/...` với path tương ứng, và khai báo type ở `src/types`.

## Phát triển

```bash
npm install
npm run build      # biên dịch -> dist/
npm test           # chạy test ký HMAC (REST + WS) + dryRun
npm run lint
```

## Lộ trình (roadmap)

- [x] `MarketDataWsClient` — realtime WebSocket OpenAPI (HMAC, cùng key/secret)
- [ ] Decode payload có schema (typed message cho ohlc/quote/trade/index)
- [ ] Hỗ trợ encoding msgpack (hiện chỉ JSON)
- [ ] Realtime trading (order/position) qua WS — OpenAPI có hỗ trợ
- [ ] Theo dõi rate-limit từ response header

## Miễn trừ trách nhiệm

Đây là thư viện cộng đồng, **không phải sản phẩm chính thức của DNSE**. Bạn tự chịu trách nhiệm với mọi lệnh giao dịch thật. Hãy luôn test với `dryRun` trước.

## License

[MIT](LICENSE)
