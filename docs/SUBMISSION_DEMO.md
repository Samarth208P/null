# NULL — 3-minute demo plan

Recommended partner entries: ENSv2, Privy and Chainlink. Record only completed actions. ENS setup/permission transactions and integrated CRE simulation are verified; the live Privy payment remains pending. Keep private payroll inputs, recovery files and credentials off-screen.

## 0:00–0:25 — Product
Show real sign-in, the organization overview and recipient inbox.
“NULL is a private payment workspace for organizations and recipients. It publishes fixed-size encrypted delivery envelopes; recipients discover and claim their own entitlements locally.”
State that this deployment uses Sepolia test USDC and supports separate public withdrawals from private notes.

## 0:25–1:00 — ENSv2
Show `inbox.nullpay2026.eth` in the recipient's name settings. Once the user has saved their backup and signed publication, show the name resolving to their Payment ID. In a new organization payment, enter that name and confirm its destination.
“ENSv2 lets this Privy wallet update one payment record without controlling the entire resolver. NULL checks the name's owner, resolver and profile again before approval, so a changed destination needs review.”
Use the actual scoped-permission and revocation transactions from `deployments/ens-sepolia.json` as supporting evidence. The `receive`/`pay` verification names are not the user's funded account.

## 1:00–1:40 — Chainlink
Prepare a small payment, show its CRE check, export privately, run the displayed CLI command, and import the result. Show review unlocking only for the matching result.
“This is the real CRE CLI simulator, using our confidential handler and shared payment compiler. We are not claiming remote enclave execution or attestation.”

## 1:40–2:25 — Privy
Once the real owner flow works, show Privy authentication, the dedicated organization wallet and owner approval of the exact intent. Show the confirmed Sepolia transaction.
“Privy enforces our owner quorum before the wallet authorizes this payment. NULL binds approval to its chain, pool and encrypted batch.”
An identity-only signature obtains the public key; it is not a payment. Never present the isolated rehearsal signer as Privy.

## 2:25–2:45 — Recipient
Once funded, show live Graph indexing, local recipient discovery, a confirmed claim, then Withdraw from Balance. Show the receiving wallet's token balance increasing by the exact reviewed amount. Explain that names simplify delivery setup while encrypted envelopes keep allocations private, and that withdrawal exposes the destination and amount.

## 2:45–3:00 — Evidence
Show public source, deployment manifest, transaction links and recovery verification. State testnet-only, public deposit and withdrawal boundaries, local CRE simulation and no production audit.
Attach a two-to-four-minute video. Link sponsor entries directly to ENS record permissions, workflow code, Privy controls and actual execution evidence. Disclose pre-existing work under the correct hackathon pool. Do not claim completed Privy payments before demonstrating them. Graph continues to support the product without consuming a selected partner-prize slot.

