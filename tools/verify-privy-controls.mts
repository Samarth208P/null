import { readRootEnv } from '../contracts/scripts/env.mjs';
import { createPrivyOrganizationAuthorizer } from '../packages/auth/src/server.ts';
import type { Hex } from '../packages/sdk/src/index.ts';
const saved = readRootEnv();
async function main() {
  const authorizer = createPrivyOrganizationAuthorizer({ appId: saved.PRIVY_APP_ID!, appSecret: saved.PRIVY_APP_SECRET!, walletId: saved.PRIVY_ORGANIZATION_WALLET_ID!, walletAddress: saved.PRIVY_ORGANIZATION_WALLET_ADDRESS as Hex, ownerQuorumId: saved.PRIVY_ORGANIZATION_OWNER_QUORUM_ID!, organizationEntityId: saved.PRIVY_ORGANIZATION_ENTITY_ID!, minimumApprovals: Number(saved.PRIVY_ORGANIZATION_MINIMUM_APPROVALS), chainId: BigInt(saved.NULL_CHAIN_ID!), poolAddress: saved.NULL_POOL_ADDRESS as Hex, controlMode: saved.PRIVY_ORGANIZATION_CONTROL_MODE === 'owner-quorum' ? 'owner-quorum' : 'policies-and-quorum', requiredPolicyIds: (saved.PRIVY_ORGANIZATION_POLICY_IDS || '').split(',').filter(Boolean), expectedOwnerUserIds: (saved.PRIVY_ORGANIZATION_MEMBER_IDS || '').split(',').filter(Boolean) });
  const wallet = await authorizer.verifyWalletControl();
  // A harmless raw digest with no owner authorization must be rejected. Never a transaction.
  const response = await fetch(`https://api.privy.io/v1/wallets/${saved.PRIVY_ORGANIZATION_WALLET_ID}/rpc`, { method: 'POST', headers: { 'privy-app-id': saved.PRIVY_APP_ID!, Authorization: `Basic ${Buffer.from(`${saved.PRIVY_APP_ID}:${saved.PRIVY_APP_SECRET}`).toString('base64')}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'secp256k1_sign', params: { hash: '0x' + '01'.repeat(32) } }), signal: AbortSignal.timeout(25000) });
  if (![401,403].includes(response.status)) throw new Error('The unsigned challenge did not return an authorization rejection. Inspect provider compatibility before claiming control enforcement.');
  console.log(JSON.stringify({ liveControlVerified: true, walletAddress: wallet.address, hasPublicKey: Boolean(wallet.public_key), unsignedRequestRejected: true, httpStatus: response.status, signedApprovalExecuted: false }, null, 2));
}
main().catch(error => { console.error(error instanceof Error && error.message.startsWith('NULL_') ? error.message : 'Control verification did not complete. No credentials or provider response were logged.'); process.exitCode = 1; });
