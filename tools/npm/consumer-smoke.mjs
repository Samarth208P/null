import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preparePayout, resolvePayoutRecipients } from '@samarth208p/null-payouts';
import { NullLiveClient, PayoutClient } from '@samarth208p/null-payouts/client';
import { PayoutJob, partitionPayoutRecipients } from '@samarth208p/null-payouts/jobs';
import { planWithdrawal } from '@samarth208p/null-payouts/withdrawals';
import { verifyCreResult } from '@samarth208p/null-payouts/cre';
import { createPrivacyProfile, compileDistribution, parsePublicBundle } from '@samarth208p/null-payouts/sdk';
import { ENS_V2 } from '@samarth208p/null-payouts/ens';
import { encryptRecovery, decryptRecovery } from '@samarth208p/null-payouts/wallet';
import { proveInWorker } from '@samarth208p/null-payouts/prover';
import { sepolia } from 'viem/chains';
import { zeroAddress } from 'viem';

for (const callable of [NullLiveClient, PayoutClient, PayoutJob, planWithdrawal, verifyCreResult]) assert.equal(typeof callable, 'function');
const { profile, keys } = createPrivacyProfile();
const context = { chainId: 11155111n, poolAddress: '0x1111111111111111111111111111111111111111' };
const ens = {
  chain: sepolia, getChainId: async () => 11155111, getBlockNumber: async () => 123n,
  getEnsResolver: async () => context.poolAddress, getEnsText: async () => profile.stealthMetaAddress,
  readContract: async ({ functionName }) => {
    if (functionName === 'findOwner') return context.poolAddress;
    if (functionName === 'findParentRegistry') return zeroAddress;
    if (functionName === 'verifyContract') return ENS_V2.resolverImplementation;
    throw new Error(`Unexpected fixture read: ${functionName}`);
  },
};
const rows = [{ reference: 'npm-consumer-private', name: 'alice.eth', amount: '0.25' }];
const recipients = await resolvePayoutRecipients(ens, rows);
const draft = await preparePayout({ ens, context, recipients });
assert.equal(draft.summary.totalAmountAtomic, 250000n);
assert.equal(draft.publicBundle.envelopes.length, 8);
assert.equal(parsePublicBundle(JSON.stringify(draft.publicBundle)).version, 1);
assert.ok(!JSON.stringify(draft.publicBundle).includes(rows[0].reference));
assert.throws(() => JSON.stringify(draft), /private data/);
assert.deepEqual(partitionPayoutRecipients(Array.from({ length: 9 }, (_, i) => ({ ...rows[0], reference: String(i) }))).map(group => group.length), [8, 1]);
const compiled = await compileDistribution({ context, recipients: [{ employeeRef: 'local', amountAtomic: 250000n, stealthMetaAddress: profile.stealthMetaAddress }] });
assert.equal(compiled.envelopes.length, 8);
const encrypted = await encryptRecovery(keys, 'consumer-test-password-only');
assert.deepEqual(await decryptRecovery(encrypted, 'consumer-test-password-only'), keys);

// Exercise only worker URL resolution/lifecycle here; this does not generate a proof.
let workerUrl;
let terminated = false;
globalThis.Worker = class {
  constructor(url) { workerUrl = url; }
  postMessage({ id }) { queueMicrotask(() => this.onmessage({ data: { id, error: 'packaging-worker-fixture' } })); }
  terminate() { terminated = true; }
};
await assert.rejects(proveInWorker({}), /packaging-worker-fixture/);
assert.ok(terminated);
assert.ok(workerUrl.pathname.endsWith('/dist/prover/src/worker.js'));
assert.ok(existsSync(fileURLToPath(workerUrl)));
assert.match(readFileSync(fileURLToPath(workerUrl), 'utf8'), /runtime\.js/);
delete globalThis.Worker;
console.log('Installed consumer passed: all public imports, real encrypted preparation, backup roundtrip, batch partitioning and proof-worker asset resolution. ENS and worker execution were test doubles; no money sent or proof generated.');
