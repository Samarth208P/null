# Withdrawal verification

Updated 2026-09-08. No Git commit or Netlify deployment was made.

## Deployment

The immutable v0.2 Sepolia pool is `0x734da58C285D211e7C0ad904f522c221c982447E`, with indexing starting at block **11659529**. All nine deployment transactions confirmed and their runtime bytecode and constructor dependencies were checked against the compiled build. Deployment gas cost **0.030505532516294055 test ETH**, below the authorized 0.05 cap. See [public manifest](../deployments/11155111-withdrawals-v2.json).

The archived v0.1 pool is unchanged and has no exit. New deposits into a manifest without withdrawal support are disabled. The new frontend checks that its configured chain/pool matches the manifest, and pins all four verifier code hashes.

The Graph Studio version **v0.2.0** indexes the new pool. The client reconstructs accumulators and compares them with chain state; an outdated indexer falls back to RPC history. Spent-note checks use the contract directly.

## Verified local flow

`pnpm test:flow` starts a fresh local chain and uses the genuine four circuits, generated EVM verifiers, contracts, production client and proof-worker adapter. Only its ERC-20 asset and funded accounts belong to the isolated test environment.

- Deposit 1 test USDC; pay and collect 0.6; retain 0.4 treasury change.
- Recover the recipient note using the original spending/viewing keys and chain history, or from its funds backup with a different current Payment ID. An old backup cannot revive a withdrawn note.
- Reject a substituted withdrawal destination using the original proof.
- Reject a failing token transfer without consuming the note or changing balances.
- Withdraw 0.6 through an independently funded HTTP relayer; confirm exact receiving and pool balance deltas.
- Reconcile a successful withdrawal from public history without its returned transaction hash.
- Reject double withdrawal in both client and contract.
- Reject treasury withdrawal without its registered policy signature.
- Refund 0.4 with the policy signer; verify the pool is empty and token totals balance exactly.

`pnpm test:withdrawal` adds six focused cases, including real Noir execution of recipient and treasury witnesses and rejection of an incorrect owner. The 27 existing submission tests also pass. These are implementation tests, not an independent security audit.

## Sepolia rehearsal

The user authorized a 0.1 test USDC round trip, then explicitly reallocated the unused deployment allowance while retaining a combined 0.065 test ETH cap. The separate encrypted rehearsal journal preserves keys, policy openings, checkpoints and signed transactions before broadcast. The complete Sepolia round trip passed: deposit 0.1 → distribute/claim/withdraw 0.06 → approved treasury refund 0.04. The token balance returned exactly to its initial value, the pool ended at zero, and the encrypted journal was decrypted and verified. Rehearsal gas cost 0.030458429967239064 test ETH; combined deployment and rehearsal cost **0.060963962483533119 test ETH**, below 0.065. See [confirmed public receipts](../deployments/payment-flow-sepolia-v2.json). Do not blindly restart an interrupted rehearsal.

The rehearsal uses a local isolated signer and a single funded broadcaster. It does not count as a Privy-owner-approved payment or demonstrate an anonymity set.

## Product and privacy boundaries

Withdraw one full note at a time. The proof binds the destination, amount, chain, pool, nonce and expiry. Treasury exits require organization approval. Balances update after confirmed effects; unknown submission results require reconciliation.

The source note's membership and ownership are private proof inputs. Public withdrawals still expose the receiving address, amount and timing. Wallet reuse, gas funding, network metadata and a small anonymity set can correlate activity. Neither stealth addressing nor a relayer guarantees untraceability or zero risk. Use test funds only.

Netlify remains user-managed. Its public pool, deployment block and Graph settings must match this release. The organization Function also requires server-only Privy settings and the new pool address. A real owner-approved financial flow remains a separate required submission check; see [Netlify instructions](NETLIFY_SUBMISSION.md).
