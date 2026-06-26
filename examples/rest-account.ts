/**
 * Authenticated account example — set DNSE_API_KEY / DNSE_API_SECRET first.
 *
 *   DNSE_API_KEY=... DNSE_API_SECRET=... npx ts-node examples/rest-account.ts
 */
import { RestClient, AccountsResponse } from '../src';

async function main() {
  const client = new RestClient({
    apiKey: process.env.DNSE_API_KEY,
    apiSecret: process.env.DNSE_API_SECRET,
  });

  const accounts = (await client.getAccounts()) as AccountsResponse;
  console.log('Accounts:', accounts);

  const accountNo = accounts.accounts?.[0]?.accountNo;
  if (!accountNo) {
    console.log('No sub-accounts found.');
    return;
  }

  const balances = await client.getBalances(accountNo);
  console.log('Balances:', balances);

  const positions = await client.getPositions(accountNo, { marketType: 'STOCK' });
  console.log('Positions:', positions);

  const orders = await client.getOrders(accountNo, 'STOCK');
  console.log("Today's orders:", orders);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
