/** Read-only verification of the real ENS integration. Requires no secret configuration. */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createPublicClient, http } from '../apps/web/node_modules/viem/_esm/index.js';
import { sepolia } from '../apps/web/node_modules/viem/_esm/chains/index.js';
import { inspectPaymentName, paymentEditorAccess, prepareProfileWrite, resolvePaymentName } from '../packages/ens/src/index.ts';

async function main() {
  const deployment = JSON.parse(await readFile('deployments/ens-sepolia.json', 'utf8'));
  const client = createPublicClient({chain:sepolia,transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:20_000,retryCount:1}),cacheTime:0});
  const primary = await resolvePaymentName(client, deployment.paymentName);
  const alias = await resolvePaymentName(client, deployment.alias);
  assert.equal(primary.profile, alias.profile);
  assert.equal(primary.fingerprint, deployment.profileFingerprint);
  assert.equal((await paymentEditorAccess(client, primary.name, deployment.editor)).allowed, false);
  const setup = deployment.recipientSetup;
  const recipient = await inspectPaymentName(client, setup.name);
  assert.equal(recipient.owner.toLowerCase(), setup.wallet.toLowerCase());
  const access = await paymentEditorAccess(client, setup.name, setup.wallet);
  assert.ok(access.allowed && !access.broaderAccess);
  await prepareProfileWrite(client, setup.name, primary.profile, setup.wallet, recipient.resolver);
  console.log(JSON.stringify({chainId:11155111,checkedAt:new Date().toISOString(),block:primary.blockNumber,paymentName:primary.name,alias:alias.name,liveResolution:true,testEditorRevoked:true,privyRecipientName:recipient.name,privyWalletOwnsName:true,privyRecordAccess:'one name, one key',privyWriteEthCallPassed:true,recipientProfilePublished:!!recipient.value,transactionsSent:0},null,2));
}
try { await main(); } catch { console.error('Live ENS verification failed. Check Sepolia availability, ownership and current records before demonstrating the integration.'); process.exitCode = 1; }
