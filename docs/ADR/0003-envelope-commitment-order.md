# ADR 0003 — Remove the circular envelope commitment

The original encrypted-envelope plaintext includes the final distribution commitment, while the distribution commitment depends on the root of the encrypted envelopes. That creates a circular dependency.

The implemented plaintext carries the allocation root and path, transport tag, chain/pool context, allocation opening and a leaf hint. It omits the final distribution commitment. After decryption, the scanner combines the authenticated allocation root with the public envelope root and transport tag to reconstruct the final commitment, then verifies it against the accepted public distribution record.

Ciphertext size stays constant across real and dummy slots. No recipient data becomes public. This resolves compilation order without weakening context or membership binding. Tests and cross-language vectors still need to validate the resulting format before release.

Exact offsets and domain inputs are specified in [../WIRE_FORMAT.md](../WIRE_FORMAT.md). Public copy must describe a committed encrypted allocation, not claim the final distribution hash is embedded in its own ciphertext.
