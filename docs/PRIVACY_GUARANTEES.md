# Privacy boundaries

This is a development implementation, not an audited privacy guarantee. The complete local proof flow and adversarial withdrawal checks have run; see WITHDRAWAL_VERIFICATION.md for the exact evidence and live-test status. Live assertions require the matching deployed contracts, genuine ZK-enabled verifiers and intact client software.

| Data | Private-flow treatment |
|---|---|
| Names, email, employee references | Local sender metadata, absent from exported protocol bundle |
| Amount per recipient | Private witness and encrypted allocation |
| Long-term profile | Shared with sender directly or through a public ENS record; not a receiving EOA |
| One-time stealth public key | Committed and encrypted, not plaintext in protocol events |
| Spending/viewing secrets | Local only, encrypted at rest when saved |
| Distribution existence | Public |
| Number of real recipients | Padded within eight public slots |
| Allocation root/index during claim | Private witness |
| Claim source | Membership against global distribution accumulator |
| Claim nullifier/output commitment | Public; required for consumption and note state |
| Public deposit | Sender, amount, token and timing visible |
| Public withdrawal | Implemented in v0.2; destination, amount and time are public. Source note membership stays inside the proof. |

RPCs, indexers, relayers and hosting providers can observe network metadata. Broadcast timing, application usage and deposit correlation can narrow an anonymity set. Fixed envelopes do not hide distribution frequency or network origin. Employers necessarily know their intended recipient/amount mappings. Malicious frontend code and compromised devices can expose plaintext regardless of encryption design.

Local sandbox results prove no onchain privacy property. The sandbox describes its artifacts as local and never fabricates proofs, transaction hashes, confirmations, CRE execution or Privy quorum approval.
