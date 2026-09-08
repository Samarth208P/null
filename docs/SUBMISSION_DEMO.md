# NULL — 3-minute demo plan

Record only completed actions. The live Privy payment and Substreams segments remain pending. Keep private payroll inputs, recovery files and credentials off-screen.

## 0:00–0:25 — Product
Show real sign-in, the organization overview and recipient inbox.
“NULL is a private payment workspace for organizations and recipients. It publishes fixed-size encrypted delivery envelopes; recipients discover and claim their own entitlements locally.”
State that this deployment uses Sepolia test USDC and has no withdrawal path.

## 0:25–1:05 — Chainlink
Prepare a small payment, show its CRE check, export privately, run the displayed CLI command, and import the result. Show review unlocking only for the matching result.
“This is the real CRE CLI simulator, using our confidential handler and shared payment compiler. We are not claiming remote enclave execution or attestation.”

## 1:05–1:55 — Privy
Once the real owner flow works, show Privy authentication, the dedicated organization wallet and owner approval of the exact intent. Show the confirmed Sepolia transaction.
“Privy enforces our owner quorum before the wallet authorizes this payment. NULL binds approval to its chain, pool and encrypted batch.”
An identity-only signature obtains the public key; it is not a payment. Never present the isolated rehearsal signer as Privy.

## 1:55–2:35 — The Graph and recipient
Show live subgraph indexing, local recipient discovery and a confirmed claim. Once verified, show a live standalone Substreams provider run and its consumer reusing the NULL/ERC-5564 event model. Explain which fields stay consistent across protocols.
The event subgraph alone does not establish composition. Graph Studio no longer hosts Substreams-powered subgraphs.

## 2:35–3:00 — Evidence
Show public source, deployment manifest, transaction links and recovery verification. State testnet-only, no withdrawals, local CRE simulation and no production audit.
Attach a two-to-four-minute video. Link sponsor entries directly to workflow code, Privy controls, shared Graph schema/module and actual execution evidence. Disclose pre-existing work under the correct hackathon pool. Do not claim live Substreams or completed Privy payments before demonstrating them.

