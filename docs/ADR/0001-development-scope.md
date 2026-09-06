# ADR 0001 — Development implementation and deferred testing

The user requested completion of development with a minimal premium interface and explicitly asked to leave testing out. This implementation therefore adds application, cryptography, circuits, contracts, indexing and service source, and runs development compilers, without creating or executing the PRD's testing program.

This differs from PRD sections 7, 59–64, 74, 76 and 126. Their testing and release acceptance requirements are outstanding, not waived for a real deployment. No public claim may describe this work as security validated or production ready.

The application starts in an explicit local sandbox, with sample funds and in-memory ledger state. It runs real encryption, commitments and local discovery. It does not replace verification with a simulated proof or present local publication as a confirmed transaction. Sponsor integrations are configuration-dependent, and successful live execution is not claimed.

This decision has no intended change to protocol privacy formulas. Its practical security impact is that all untested implementation risks remain open. Compiler success is the only development evidence reported.
