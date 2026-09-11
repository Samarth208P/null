# Privacy boundaries

This is a development implementation, not an audited privacy guarantee. The complete local proof flow and adversarial withdrawal checks have run; see WITHDRAWAL_VERIFICATION.md for the exact evidence and live-test status. Live assertions require the matching deployed contracts, genuine ZK-enabled verifiers and intact client software.

| Data | Private-flow treatment |
|---|---|
| Names, email, employee references | Private sender references are absent from the protocol bundle. ENS names and their linked profiles are public; RPC providers can observe name lookups. |
| Amount per recipient | Private witness and encrypted allocation |
| Long-term profile | Live app requires a public ENS payment record; profile contains public keys, not a receiving EOA. Low-level SDK accepts profiles directly. |
| One-time stealth public key | Committed and encrypted, not plaintext in protocol events |
| Spending/viewing secrets | Local only, encrypted at rest when saved |
| Distribution existence | Public |
| Number of real recipients | Padded within eight public slots |
| Allocation root/index during claim | Private witness |
| Claim source | Membership against global distribution accumulator |
| Claim nullifier/output commitment | Public; required for consumption and note state |
| Public deposit | Sender, amount, token and timing visible |
| Public withdrawal | v0.2 exits a whole note. New local v0.3 can exit part and create exact private change. Destination, withdrawn amount and timing are public; source membership remains inside the proof. |
| Private remainder | v0.3 emits a new change commitment in the withdrawal transaction. Its amount and opening are private, but observers can see that the transaction created a commitment. |
| Large payout job | Several public distributions with eight slots each. Padding does not hide the number, timing or linkage of job submissions. |
| Gas sponsor | Receives the public operation and network metadata and funds the transaction. No recipient key or plaintext roster is needed. It is not an anonymity guarantee. |

RPCs, indexers, relayers and hosting providers can observe network metadata. Broadcast timing, application usage and deposit correlation can narrow an anonymity set. Fixed envelopes do not hide distribution frequency or network origin. Employers necessarily know their intended recipient/amount mappings. Malicious frontend code and compromised devices can expose plaintext regardless of encryption design.

Local sandbox results prove no onchain privacy property. The sandbox describes its artifacts as local and never fabricates proofs, transaction hashes, confirmations, CRE execution or Privy quorum approval.

The chain does not receive a plaintext sender-to-recipient allocation table or the original received amount in a v0.3 partial-withdrawal proof. It still sees the pool's public deposits, withdrawals, spent nullifiers and output commitments. A single depositor, immediate payout/claim/withdrawal, reused public withdrawal address, or repeated exits can make inference easy. Partial withdrawals reduce exact-amount matching in some usage patterns; they cannot establish that the sender and received amount are unknowable. Do not describe this as “no trace.”

The [v0.3 local rehearsal](PAYOUT_V3_VERIFICATION.md) is separate from the canonical v0.2 Sepolia deployment. For partial change, keep the updated encrypted funds backup: original recipient identity keys alone do not reconstruct fresh random change openings. Multiple source notes can require multiple public transfers to withdraw one requested aggregate amount.
