# Live protocol client

`@null-protocol/client` connects the implemented cryptographic SDK, local prover, immutable pool contracts, discovery index, and a connected wallet or relayer. It performs actual operations only against a complete, pinned testnet deployment. Missing deployments, proving artifacts, verification keys, mismatched runtime code, incomplete chain history, expired proofs, and invalid signatures stop the operation.

The application can retain its local rehearsal while deployment is unavailable. This package never converts a rehearsal balance, imported JSON record, or completed animation into a confirmed blockchain transaction.

## Deployment prerequisites

Use the deployment manifest emitted by `contracts/scripts/deploy.mjs`, after the circuit build generates all three ZK-enabled verifiers. The manifest must have:

- `status: deployed`, protocol `0.1.0`, Sepolia chain ID `11155111` or local development `31337`, and the registry deployment block;
- the six contract addresses, asset address, and nonzero Keccak runtime code hashes for all seven;
- the six-decimal asset configuration;
- the exact pinned Noir and Barretenberg versions;
- all three circuit artifact URLs, artifact SHA-256 hashes, verification-key SHA-256 hashes, and generated-verifier-source hashes.

Serve the circuit JSON files at the URLs in the manifest. `artifactBaseUrl` resolves relative artifact paths against the hosted application's origin. The client rejects ordinary insecure HTTP endpoints; loopback HTTP is allowed for development. Large proof artifacts remain public downloads. The worker never uploads witnesses or recipient secrets.

The manifest itself is the trust anchor. Review and pin it in the deployment process; accepting a manifest from an arbitrary party would accept that party's contracts and hashes. Asset runtime pinning does not pin a proxy implementation behind an upgradeable token. The prototype remains testnet-only. Protocol v0.2 adds full-note withdrawal with exact destination and amount binding; v0.1 cannot withdraw.

## Construct the client and encrypted local storage

```ts
import {
  NullLiveClient,
  createEncryptedCheckpointStore,
  validateDeploymentManifest,
  type DeploymentManifest,
} from '@null-protocol/client';

// Load this from the reviewed deployment configuration, not a recipient upload.
const manifest: DeploymentManifest = reviewedDeploymentManifest;
validateDeploymentManifest(manifest);

const recoveryStore = createEncryptedCheckpointStore({
  namespace: 'my-business-sepolia',
  getPassword: async () => unlockedRecoveryPassword,
});

const client = new NullLiveClient({
  manifest,
  rpcUrls: configuredRpcUrls,
  graphUrl: configuredGraphEndpoint,
  artifactBaseUrl: window.location.origin,
  confirmations: 12,
  persistLocalSecret: recoveryStore.persistLocalSecret,
});

await client.verifyDeployment();
```

The password must contain at least twelve characters. Keep an unlocked password in memory for the session and clear it on lock. No password, treasury secret, profile key, decrypted payroll row, private signature, or witness belongs in server storage or logs.

The bundled store uses PBKDF2-HMAC-SHA256 with 600,000 iterations, a fresh 32-byte salt, AES-256-GCM, a fresh 12-byte nonce, and namespace-bound authenticated data. IndexedDB contains ciphertext only. The callback used by the live client must complete before a proof is offered for publication, so a storage failure cannot silently create an unrecoverable treasury deposit or change output.

Recipient base profile recovery is still handled by `@null-protocol/wallet`. Business authorization openings and treasury notes need the additional live recovery archive:

```ts
const encryptedArchive = await recoveryStore.exportEncrypted();
// Download encryptedArchive as a local file. It still requires the original password.
// To restore, construct a store with the original namespace/password, then:
await recoveryStore.importEncrypted(encryptedArchive);
const { checkpoints, policies } = await recoveryStore.load();
```

Archive import authenticates every record and checks its identifier before a single atomic IndexedDB write. It cannot restore a forgotten password. JavaScript memory zeroization is best effort.

## Register the business policy

An authorization policy commits the business signer's secp256k1 public key, a canonical metadata field, and a nonzero random registration blinder. Obtain the public key from the actual Privy-controlled signer. Preserve the opening in encrypted local storage.

```ts
import { deriveField, randomBytes, utf8 } from '@null-protocol/sdk';

const seed = randomBytes(32);
const opening = {
  signerPublicKey: actualBusinessSignerPublicKey,
  policyMetadata: 0n,
  registrationBlinder: deriveField(seed, utf8('null.v1.policy-registration')),
};
seed.fill(0);

const registered = await client.registerPolicy({
  opening,
  wallet: connectedBusinessWallet, // viem WalletClient
  persistLocalPolicy: recoveryStore.persistLocalPolicy,
  onTransactionSubmitted: ({ hash }) => showExplorerLink(hash),
});
```

Registration is a real registry transaction. A preexisting policy is accepted only if it appears in confirmed reconstructed history. The policy opening's signing key controls subsequent private business authorization; the registration transaction does not expose the opening or create a shortcut around signature verification.

## Shield treasury funds

The product must disclose that the deposit wallet, asset, amount, and time are public, and that withdrawals reveal the receiving wallet, amount and time. The API requires an explicit acknowledgment of this boundary. Do not automatically shield the exact payroll total immediately before a private distribution.

```ts
import { parseAmount } from '@null-protocol/sdk';

const preparedDeposit = await client.prepareShield({
  amountAtomic: parseAmount('25000'),
  policyCommitment: registered.policyCommitment,
  acknowledgePublicDepositAndNoWithdrawal: true,
  onProgress: updateProgress,
});

const deposit = await client.submit(
  preparedDeposit,
  { mode: 'wallet', wallet: connectedBusinessWallet },
  {
    onProgress: updateProgress,
    onTransactionSubmitted: ({ hash, purpose }) => showPendingTransaction(hash, purpose),
  },
);
```

Preparation generates hidden owner/note secrets, saves their encrypted checkpoint, builds the amount-bound shield witness, and proves locally. Submission validates the deployment again, checks the funding balance, and updates only the required token allowance. A nonzero insufficient allowance is reset to zero before setting the exact amount. Allowance updates are simulated and confirmed before the pool call.

The pool call is simulated with the funding account, gas is estimated, and the connected wallet sends it. The client waits for the configured confirmation count, checks the canonical receipt block, matches the transaction target and exact calldata, and verifies the expected `Shielded` and `NoteInserted` events. `deposit.note` contains the actual finalized commitment/index and its local secrets. The return value is never based on a transaction hash alone.

## Compile, authorize, and publish a distribution

The compiler creates eight real/dummy encrypted slots. The live client reconstructs confirmed note and authorization accumulators, validates the selected treasury openings, checks spent nullifiers, and prepares the exact 15-field business intent.

```ts
import { compileDistribution } from '@null-protocol/sdk';
import { authorizeOrganizationDistribution } from '@null-protocol/auth';

const compiled = await compileDistribution({
  context: client.context,
  recipients: privatePayrollRows,
});

const preparedDistribution = await client.prepareDistribution({
  compiled,
  treasuryNotes: [ownedTreasuryNote],
  authPolicy: opening,
  validForSeconds: 3600,
  authorize: async intent => {
    const authorization = await authorizeOrganizationDistribution({
      endpoint: configuredOrganizationService,
      appId: configuredPrivyAppId,
      expectedSigner: actualBusinessSignerAddress,
      getAccessToken,
      generateAuthorizationSignature,
      publicInputs: intent.publicInputs,
      expected: {
        ...intent.context,
        commitment: intent.commitment,
        envelopeRoot: intent.envelopeRoot,
      },
    });
    return authorization.compactSignature;
  },
  onProgress: updateProgress,
});

const distribution = await client.submit(preparedDistribution, {
  mode: 'relay',
  url: configuredRelayerBaseUrl + '/api/relay',
});
```

`authorizeOrganizationDistribution` belongs to `@null-protocol/auth`; application hooks provide the actual Privy session and request authorization. The callback may instead use another explicitly approved business authorization integration, but it must return a valid 64-byte compact low-S secp256k1 signature under the policy's pinned public key. The digest is raw Poseidon bytes, without a personal-sign prefix. The SDK verifies that the signature authorizes this exact commitment, encrypted envelope root, input nullifiers, change output, chain, pool, nonce, and expiry.

When using a confidential compiler, supply the same unique secret batch entropy to authorized local and TEE compilation and call `assertCompilationMatches` before live preparation. Never send the complete private compiled object to the relayer. The live transport includes only proof, public inputs, and fixed encrypted envelopes.

The result includes the actual distribution commitment and finalized private treasury change note. Both consumed input nullifiers must read as spent before success is returned. Zero-valued change is still inserted but cannot be selected as a positive treasury input later.

## Discover and claim

```ts
const inbox = await client.discover({ keys: locallyUnlockedProfileKeys });
const allocation = inbox.find(item => !item.spent);
if (!allocation) return;

const preparedClaim = await client.prepareClaim({
  allocation,
  validForSeconds: 3600,
  onProgress: updateProgress,
});

const claim = await client.submit(preparedClaim, {
  mode: 'relay',
  url: configuredRelayerBaseUrl + '/api/relay',
});
```

Scanning sends no keys to Graph or RPC. Public indexed trees are reconstructed and checked against historical onchain roots/counts at one confirmed block. A Graph inconsistency triggers full RPC fallback. An incomplete RPC history stops the flow. A newly deployed pool whose history has not reached the requested confirmation depth cannot be treated as confirmed.

Claim preparation reconstructs current confirmed distribution membership, builds the hidden allocation witness, derives recoverable note secrets locally, signs the output-bound claim intent with the one-time stealth scalar, saves a local checkpoint, and runs the local proof worker. Submission checks root acceptance and unspent status again before simulation. The receipt must contain the expected private note and matching allocation-consumption event, and the claim nullifier must read as spent.

Neither the claim transport nor the public operation export contains the hidden distribution commitment, transport tag, allocation position, amount, recipient public key, signature, or secret witness.

## Relayer fallback and uncertain outcomes

The same prepared proof can be explicitly self-broadcast:

```ts
await client.submit(preparedClaim, {
  mode: 'wallet',
  wallet: independentlyFundedBroadcastWallet,
});
```

Self-broadcast exposes the broadcasting wallet and gas payment. A recipient should make that privacy choice deliberately. There is no automatic switch to a recipient wallet when a relayer fails.

`exportPublicOperation(prepared)` emits only whitelisted relay fields. `prepared.transaction` provides the same pool address, chain ID, exact calldata, and zero value for an independent broadcaster. Do not serialize the complete prepared object: its `recovery` member is private local state.

A relay timeout, unclear wallet submission failure, or receipt timeout throws `SubmissionUncertainError` with the public operation and any known transaction hash. This is not reported as a failed payment, and the client does not automatically retry or switch transports. Reconcile the hash and public nullifiers first. A rejected relayer request can be retried through another broadcaster with the exact same proof and bound output. Expired or stale-root proofs must be rebuilt and, for a business distribution, reauthorized.

```ts
const state = await client.reconcile(preparedClaim, lastKnownTransactionHash);
// confirmed: actual receipt/effects verified, local checkpoint repaired
// pending: known transaction has no sufficiently confirmed receipt yet
// reverted: canonical confirmed transaction reverted
// not-observed: no match in confirmed history; the original request may still be pending
```

If no hash is known, reconciliation scans broad confirmed public history for the matching nullifier, distribution commitment, or funded note body and then verifies the exact transaction calldata. An inconclusive result does not unlock an automatic retry. The client blocks resubmitting an operation with an uncertain outcome until it can establish a confirmed result or confirmed revert. RPC errors remain errors rather than being labeled as pending chain state.

The client permits cancellation during preparation and before submission. A submitted blockchain transaction cannot be canceled by terminating local proof work or dismissing a progress indicator. `onTransactionSubmitted` reports approval, policy-registration, and pool transaction hashes as soon as they are known.

## Recovery after reload or service outage

```ts
const saved = await recoveryStore.load();
const treasury = await client.recoverTreasuryNotes(saved.checkpoints);
const spendable = treasury.filter(item => !item.spent && item.note.amountAtomic > 0n);

const privateNotes = await client.recoverPrivateNotes({
  keys: restoredRecipientProfileKeys,
  forceRpc: true,
});
```

Treasury recovery matches saved hidden bodies to public finalized commitment/index pairs and checks note nullifiers. Recipient recovery decrypts public envelopes, rederives the same note owner/secret, matches consumed allocations to private note commitments, and reconstructs note records. Previously published entitlements do not require the original organization service, TEE compiler, Graph provider, or hosted relayer.

If saving the confirmed checkpoint fails after the transaction succeeds, the result has `localRecoverySaved: false`. The initial prepared checkpoint was already saved before publication, so chain-history recovery can complete the local record. The application should show the confirmed transaction and prompt the user to retry/export local recovery rather than misreport the transaction as failed.

## Development status

The controller and encrypted storage are implemented and TypeScript-compiled. No live deployment, proof generation exercise, wallet transaction, relay submission, recovery test, or end-to-end test was executed while developing this package, in accordance with the request to leave testing aside. Configure the actual reviewed deployment and sponsor credentials before enabling live UI actions. Real-value use remains out of scope.
