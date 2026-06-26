/**
 * Full trading flow: OTP -> trading token -> place order.
 *
 *   DNSE_API_KEY=... DNSE_API_SECRET=... DNSE_EMAIL=... npx ts-node examples/rest-place-order.ts
 *
 * NOTE: this places a REAL order if you remove dryRun. Keep dryRun while testing.
 */
import { RestClient, TradingTokenResponse } from '../src';

async function main() {
  const client = new RestClient({
    apiKey: process.env.DNSE_API_KEY,
    apiSecret: process.env.DNSE_API_SECRET,
  });

  // 1) Trigger an email OTP (or use Smart OTP from the app).
  await client.sendEmailOtp({ email: process.env.DNSE_EMAIL! });
  console.log('OTP sent — check your email.');

  // 2) Exchange the passcode for a short-lived trading token.
  const passcode = process.env.DNSE_OTP_CODE!; // wire this up to your input flow
  const token = (await client.createTradingToken({
    otpType: 'email',
    passcode,
  })) as TradingTokenResponse;

  // 3) Place the order, passing the token. dryRun=true prints instead of sending.
  const result = await client.placeOrder(
    'STOCK',
    {
      accountNo: process.env.DNSE_ACCOUNT_NO!,
      symbol: 'HPG',
      side: 'BUY',
      orderType: 'LO',
      price: 25950,
      quantity: 100,
      loanPackageId: 2396,
    },
    { tradingToken: token.tradingToken, dryRun: true },
  );

  console.log('Order result:', result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
