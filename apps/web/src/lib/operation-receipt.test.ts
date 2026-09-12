import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConfirmedOperation, PreparedOperation } from '@null-protocol/client';
import { publicOperationReceipt } from './operation-receipt';

const pool = `0x${'11'.repeat(20)}` as const;
const hash = `0x${'22'.repeat(32)}` as const;
const commitment = `0x${'33'.repeat(32)}` as const;
function fixture() {
  const prepared = { publicOperation: { chainId: 11155111, pool, method: 'createDistribution', proof: 'secret-proof-do-not-copy', publicInputs: ['0x1', '0xaa36a7', pool, '0x0', '0x0', '0x0', '0x0', commitment] },
    transaction: { chainId: 11155111, to: pool, data: '0x1234' }, recovery: { noteSecret: 'PRIVATE_RECOVERY' } } as unknown as PreparedOperation;
  const confirmed = { transactionHash: hash, distributionCommitment: commitment, note: { amountAtomic: 999n, noteSecret: 'PRIVATE_NOTE' },
    receipt: { status: 'success', transactionHash: hash, to: pool, blockNumber: 10n, blockHash: hash, gasUsed: 123n } } as unknown as ConfirmedOperation;
  return { prepared, confirmed };
}
test('shareable receipt allows only public fields and labels client-observed workflow origin', () => {
  const { prepared, confirmed } = fixture();
  const value = publicOperationReceipt(prepared, confirmed, { approval: 'privy-owner', compilation: 'cre-local-simulation', protocolVersion: '0.2.0' });
  assert.equal(value.workflow.approval, 'privy-owner');
  assert.equal(value.workflow.recordedBy, 'local-client');
  assert.equal(value.workflow.remoteAttestationVerified, false);
  assert.equal(value.gasUsed, '123');
  const json = JSON.stringify(value);
  for (const secret of ['PRIVATE_RECOVERY', 'PRIVATE_NOTE', 'secret-proof-do-not-copy', '999']) assert.ok(!json.includes(secret));
  assert.ok(!('note' in value) && !('recovery' in value) && !('publicInputs' in value));
});
test('reverted, unrelated or context-mismatched receipts cannot be exported as confirmed', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.confirmed.receipt.status = 'reverted'; },
    (f: ReturnType<typeof fixture>) => { f.confirmed.transactionHash = commitment; },
    (f: ReturnType<typeof fixture>) => { f.confirmed.receipt.to = `0x${'44'.repeat(20)}`; },
    (f: ReturnType<typeof fixture>) => { f.prepared.publicOperation.publicInputs[1] = '0x1'; },
    (f: ReturnType<typeof fixture>) => { f.confirmed.distributionCommitment = hash; },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => publicOperationReceipt(f.prepared, f.confirmed, { approval: 'privy-owner', protocolVersion: '0.2.0' }));
  }
});
test('imported signatures retain their source and distributions require approval evidence', () => {
  const f = fixture();
  assert.equal(publicOperationReceipt(f.prepared, f.confirmed, { approval: 'imported', protocolVersion: '0.2.0' }).workflow.approval, 'imported');
  assert.throws(() => publicOperationReceipt(f.prepared, f.confirmed, { approval: 'not-required', protocolVersion: '0.2.0' }));
});
test('recipient claim receipts do not expose source distribution or private note metadata', () => {
  const f = fixture(); f.prepared.publicOperation.method = 'claim';
  const receipt = publicOperationReceipt(f.prepared, f.confirmed, { approval: 'not-required', protocolVersion: '0.2.0' });
  assert.ok(!('distributionCommitment' in receipt));
  assert.ok(!('compilation' in receipt.workflow));
});
