# NULL wire format v1

This document specifies the implemented local compiler, encrypted transport, wallet recovery, and circuit witness encoding. Protocol publication still requires a deployed matching verifier, registered business policy, funded treasury notes, and a real proof. A local bundle is a draft, and importing one does not establish onchain acceptance.

## Canonical integers and field hashes

Every byte-level integer is unsigned, fixed-width, big-endian. Amounts are unsigned 64-bit atomic units with six decimals. Real allocations are positive; dummy allocations are zero. The text parser accepts ordinary decimal notation with at most six fractional digits and rejects exponent notation, signs, commas, excess fractional digits, zero, and overflow. Arithmetic uses `bigint` exclusively.

BN254 field modulus:

```
21888242871839275222246405745257275088548364400416034343698204186575808495617
```

Field values use exactly 32-byte big-endian encodings and must be strictly below the modulus. Arbitrary 256-bit hashes are never silently reduced. Public Keccak hashes and transport tags are split into high and low 128-bit limbs before entering a field hash. secp256k1 coordinates are each 32 bytes and are split into four total 128-bit limbs in the order `x_hi, x_lo, y_hi, y_lo`.

`H(domain, values...)` means circomlib-compatible BN254 Poseidon with the domain as its first input and the exact input arity. The browser implementation is pinned to `poseidon-lite@0.3.0`. It is not a variable-arity sponge or a fold. Every input is canonical before hashing. Circuit definitions and generated constants are in `circuits/lib` and `circuits/domains.json`.

Domain field derivation is `BE(SHA256(UTF8(label))[0:31])`, a 248-bit value. This is documented domain truncation, not a hash-to-field operation. Registered labels are:

```
null.v1.pk
null.v1.merkle
null.v1.treasury-note
null.v1.private-note
null.v1.final-note
null.v1.note-nullifier
null.v1.allocation
null.v1.distribution
null.v1.claim-nullifier
null.v1.auth-policy
null.v1.auth-intent
null.v1.note-owner
null.v1.note-secret
null.v1.phantom-nullifier
null.v1.claim-intent
```

## Stealth profiles and delivery

Profile format is `st:eth:0x` followed by the 33-byte compressed spending public key and 33-byte compressed viewing public key, in that order. Both keys must be valid secp256k1 points and must differ. No EOA address is required. The parser normalizes hexadecimal letter case. NULL uses ERC-5564 scheme 1 derivation with its own transport; it does not emit a standard ERC-5564 payment announcement or transfer tokens to the derived EOA.

For a sender scalar `r`, let `S = r * P_view`. Serialize `S` as the uncompressed point with its `04` prefix removed (64 bytes). Let `h = Keccak256(S)`. The view tag is `h[0]`. The stealth point is `P_spend + BE(h) * G`; scalar arithmetic is modulo the secp256k1 group order. A zero tweak or point-at-infinity is rejected and requires new batch entropy. The recipient recovers scalar `(p_spend + BE(h)) mod n`. Every slot has its own fresh sender scalar. The sender never learns the recipient's spending key or recovered stealth scalar.

The browser uses pinned `@noble/curves@1.9.7` and `@noble/hashes@1.8.0`. See the [ERC-5564 specification](https://eips.ethereum.org/EIPS/eip-5564) for the scheme and [noble-curves versioned source](https://github.com/paulmillr/noble-curves/tree/1.9.7) for the cryptographic implementation.

## Allocation and trees

```
pk = H(null.v1.pk, x_hi128, x_lo128, y_hi128, y_lo128)
leaf = H(null.v1.allocation, pk, amount_u64, salt_field, isReal)
parent = H(null.v1.merkle, left, right)
```

All unused flag bits are zero. Each distribution contains exactly eight leaves. Leaves are in final slot order `0..7`. The allocation tree is three levels deep. A path contains sibling nodes from leaf level upward. Bit zero of the index chooses the leaf-level side: zero means the current node is left; one means it is right. Node pairs are never sorted by value.

Global distribution, note, and authorization accumulators have depth 20. The empty leaf is field zero. Higher zero nodes repeatedly hash `(zero, zero)` with the Merkle domain. Insertion order is contract event/leaf index order. The scanner must obtain the complete public insertion history to reconstruct a trusted root; a convenient leaf hint does not authorize anything.

Dummy allocations use valid generated secp256k1 points, nonzero field salts, zero amounts, and encrypted records with `isReal=0`. Their spending/viewing scalars are derived from unique batch entropy for compilation and discarded. Dummy and real transport lengths are identical. They have no public dummy flag.

## Fixed public envelope: 608 bytes

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 1 | version, exactly `01` |
| 1 | 1 | slot, `00..07` |
| 2 | 32 | transport tag |
| 34 | 33 | compressed ephemeral secp256k1 public key |
| 67 | 1 | view tag |
| 68 | 540 | ciphertext transport |

The 540-byte ciphertext transport is `nonce[12] || AES-GCM-ciphertext[512] || authentication-tag[16]`. The encryption key is 256 bits. Nonces are unique per independently derived slot key. Default encryption and browser decryption use Web Crypto AES-GCM. A confidential compiler can inject an equivalent AES-256-GCM implementation with the same 128-bit tag; it must produce exactly the same bytes for identical compiler entropy and input.

HKDF-SHA256 encryption key:

```
IKM  = uncompressed ECDH point without 04 prefix (64 bytes)
salt = transportTag (32 bytes)
info = UTF8("null.v1.envelope-key") || AAD
L    = 32
```

AAD is exactly 66 bytes:

```
UTF8("NULL")[4] || version[1] || chainId[8] || poolAddress[20]
|| transportTag[32] || slot[1]
```

The event has equivalent structured fields: indexed `transportTag`, indexed `slot`, `version`, `ephemeralPubKey`, `viewTag`, and `ciphertext`. ABI encoding is distinct from the 608-byte hashing serialization above.

## Encrypted plaintext: 512 bytes

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 4 | magic UTF-8 `NULL` |
| 4 | 1 | version `01` |
| 5 | 1 | flags (`00` dummy or `01` real) |
| 6 | 1 | slot index |
| 7 | 8 | chain ID |
| 15 | 20 | pool address |
| 35 | 32 | transport tag |
| 67 | 32 | allocation root, canonical field |
| 99 | 8 | amount in atomic units |
| 107 | 32 | nonzero leaf salt, canonical field |
| 139 | 65 | uncompressed stealth public key, including `04` |
| 204 | 32 | allocation sibling at depth 0 |
| 236 | 32 | allocation sibling at depth 1 |
| 268 | 32 | allocation sibling at depth 2 |
| 300 | 8 | distribution leaf hint; all `ff` means unknown |
| 308 | 204 | reserved padding, all zero |

The PRD's conceptual plaintext included a final distribution commitment. This would create a circular dependency: the distribution commitment includes the envelope root, which includes the ciphertext, which would include that commitment. The implemented wire format omits the final commitment from plaintext. After decryption, the scanner derives it from the authenticated allocation root and public envelope-root/tag record and compares it to the accepted distribution record. No trust in a plaintext hint is introduced.

Envelope hash is `Keccak256(608-byte serialized envelope)`. Its binary tree has exactly eight leaves. A parent is:

```
Keccak256(UTF8("null.v1.envelope-merkle") || leftHash[32] || rightHash[32])
```

The prefix is raw UTF-8 without a terminator or length prefix. The final Keccak root remains full bytes32. Distribution commitment is:

```
H(null.v1.distribution, 1, allocationRoot,
  envelopeRoot_hi128, envelopeRoot_lo128, 0,
  transportTag_hi128, transportTag_lo128)
```

Version 1 does not enable expiry/reclaim. The committed expiry is zero.

## Deterministic compilation

Each batch starts with 32 fresh secret CSPRNG bytes. Supplied entropy is for deterministic authorized local/TEE comparison; it must never be public, reused between batches, or confused with fixture data. Compiler temporary copies are overwritten where practical. JavaScript cannot guarantee zeroization.

Each recipient reference is NFKC-normalized and trimmed, limited to 200 UTF-8 bytes, and must not contain control characters. Normalized case-insensitive references must be unique. Profiles are canonicalized to lowercase hex. Recipient bytes are:

```
referenceByteLength[2] || referenceUTF8 || amountAtomic[8]
|| profileByteLength[2] || profileUTF8
```

`deriveBytes(label,L)` means `HKDF-SHA256(entropy, UTF8("null.v1.compiler"), UTF8(label), L)`. First sort recipients lexicographically by `HMAC-SHA256(deriveBytes("ordering",32), recipientBytes)`. Append empty rows to eight. Shuffle all eight slots using descending Fisher-Yates. For each draw use `BE(deriveBytes("shuffle/COUNTER",4))`; increment the counter on every draw and reject values at or above `floor(2^32/range)*range` before reducing by the current range.

Derive the transport tag with label `transport-tag`. For final slot `i`, use distinct labels `slot/i/ephemeral`, `slot/i/leaf-salt`, and `slot/i/nonce`. The nonce uses `deriveBytes(...,12)`. Scalar derivation uses HKDF-SHA256 with salt `null.v1.scalar`, info `UTF8(label)||counter[4]`, output 32 bytes, and rejects values outside `1..secp256k1_order-1`. Field derivation uses salt `null.v1.hash-to-field`, the same info format, and rejects values outside `1..BN254_modulus-1`. Both start counter at zero. Dummy profile scalar labels are `dummy/i/spend` and `dummy/i/view`. No `Math.random()` is used.

The public bundle contains only protocol version, chain/pool, distribution commitment, envelope root, transport tag, zero expiry, and eight encrypted envelopes. Private payroll references, counts, amounts, paths, salts, and plaintext allocation roots are excluded from the public export. The compiler's private return object includes private witness material and must never be uploaded or logged wholesale.

## Scanner acceptance

Graph/RPC fetching is broad by public block ranges. A provider never receives view/spend keys. The scanner requires all eight envelopes for a distribution and verifies their public envelope root. For each slot it performs local ECDH before checking the view tag. View-tag mismatch and AEAD authentication failure are ordinary misses. Authenticated malformed plaintext is an error.

Successful discovery verifies magic/version, reserved bytes, chain, pool, transport tag, slot, flags, amount, derived stealth public key, allocation leaf, allocation path/root, final distribution commitment, and public envelope root. Chain-derived discoveries preserve the provider's confirmation status. Imported local drafts have `source=local` and are never considered confirmed. Real proof builders reject unconfirmed or local records. Applications still must authenticate provider data against the intended chain and accepted contract roots; a JSON import is not a chain oracle.

## Notes, signatures, and proof inputs

Note secrets are reproducible from the recovered stealth scalar and entitlement. For each purpose `null.v1.note-owner` and `null.v1.note-secret`, derive a nonzero field by the rejection-sampling HKDF above with info:

```
UTF8(purpose) || chainId[8] || pool[20] || distributionCommitment[32] || allocationLeaf[32]
```

```
ownerHash = H(null.v1.note-owner, ownerNullifierKey)
privateBody = H(null.v1.private-note, ownerHash, amount, noteSecret)
treasuryBody = H(null.v1.treasury-note, ownerHash, policy, amount, noteSecret)
finalNote = H(null.v1.final-note, body, leafIndex)
noteNullifier = H(null.v1.note-nullifier, finalNote, ownerNullifierKey)
claimNullifier = H(null.v1.claim-nullifier, distributionCommitment, allocationLeaf)
authPolicy = H(null.v1.auth-policy, signerPkCommitment, policyMetadata, registrationBlinder)
phantomNullifier = H(null.v1.phantom-nullifier, ownerKey, nonce, slot, policy)
```

ECDSA signatures are 64-byte compact `r[32] || s[32]`, normalized low-S. The message is the raw big-endian 32-byte Poseidon intent digest. There is no EIP-191 personal-sign prefix and no additional prehash. The signature itself is a private witness. Public input arrays contain canonical bytes32 field values, in these fixed orders:

| Circuit | Public inputs in order |
| --- | --- |
| Shield (6) | version, chain, pool, amount, treasury body, authorization policy |
| Create distribution (15) | version, chain, pool, note root, authorization root, input nullifier 0, input nullifier 1, distribution commitment, envelope root high, envelope root low, change body, transport high, transport low, nonce, valid-until |
| Claim (8) | version, chain, pool, global distribution root, claim nullifier, private note body, nonce, valid-until |

The distribution signature digest is `H(null.v1.auth-intent, all15Inputs...)` (Poseidon arity 16). The claim signature digest is `H(null.v1.claim-intent, all8Inputs...)` (arity 9). Nonces are nonzero canonical fields and valid-until is a positive uint64 Unix timestamp enforced by the pool. Neither claim inputs nor claim intent contain the specific distribution, allocation root/index, transport tag, amount, recipient key, or identity.

## Encrypted recovery and storage

Recovery plaintext is exactly 69 bytes: `NULL[4] || 01[1] || spendPrivateKey[32] || viewPrivateKey[32]`. Passwords contain 12 to 1,024 characters and are UTF-8 encoded exactly without normalization. PBKDF2-HMAC-SHA256 uses 600,000 iterations and a fresh 32-byte salt to derive an AES-256-GCM key. Encryption uses a fresh 12-byte nonce and 128-bit authentication tag. AAD is the literal UTF-8 string:

```
null.v1.recovery|PBKDF2-SHA256|600000|AES-256-GCM
```

The JSON envelope pins `format`, `version`, `kdf`, `iterations`, and `cipher`, plus hex `salt`, `nonce`, and ciphertext/tag. Parameter changes are rejected before expensive work. Recovery imports are size-limited. Wrong passwords and modified ciphertext produce the same unlock error.

IndexedDB database `null-private-wallet-v1`, store `encrypted-vaults`, persists only encrypted recovery strings. Raw keys are never stored in localStorage. A recovery file contains the base stealth keys; public history is still required to recover allocations and derive private note secrets. Losing both keys and recovery file is unrecoverable. Clearing browser storage without a backup loses access. Existing published entitlements do not require the hosted compiler, Graph endpoint, or relayer to remain available.

## Validation status

Development sources are provided. Per the current user instruction, tests, vectors, fuzzing, circuit proof exercises, and end-to-end deployment testing were not run as part of this work. This wire format is a prototype and requires cryptographic review and cross-language vectors before any real-value release.
