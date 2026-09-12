import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findNameWallet, type NameWallet } from './ens-wallet';

const organization: NameWallet = { address: '0x6567226D425c423b1A5765384Ae343aE5FDeB1d1', label: 'Privy' };
const recipient: NameWallet = { address: '0x7fD5B5B80E9F7a811b1d27Ec20879185fB987433', label: 'Privy' };

test('chooses the permitted owner instead of the first Privy wallet', async () => {
  const checked: string[] = [];
  const found = await findNameWallet([organization, recipient], recipient.address, async address => { checked.push(address); return address === recipient.address; });
  assert.equal(found, recipient);
  assert.deepEqual(checked, [recipient.address]);
});
test('ownership alone is insufficient; an authorized editor can be selected', async () => {
  assert.equal(await findNameWallet([recipient, organization], recipient.address, async address => address === organization.address), organization);
});
test('never falls back to an unauthorized wallet or treats failed reads as denial', async () => {
  assert.equal(await findNameWallet([organization], recipient.address, async () => false), undefined);
  await assert.rejects(findNameWallet([recipient], recipient.address, async () => { throw new Error('RPC unavailable'); }), /could not be checked/);
  assert.equal(await findNameWallet([organization, recipient], recipient.address, async address => { if (address === recipient.address) throw new Error('Transient read error'); return true; }), organization);
});
