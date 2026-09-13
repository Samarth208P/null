# NULL

## Register
product

## Platform
web

## Users
Application developers embed payouts with their own interface, wallet connection and local key custody. Finance administrators enter ENS names and amounts, authorize a payout job, and track confirmed batches. Recipients discover entitlements, claim private notes and withdraw funds. The existing web workspace is the reference integration.

## Product Purpose
An embeddable private payout toolkit for Ethereum. One user-facing payout job can contain many recipients; the implementation partitions it into consecutive padded distributions of at most eight recipients each. The host app can sponsor distribution, claim and withdrawal gas through an authenticated broadcast callback, or use an organization's connected wallet. Funding an ordinary EOA treasury still needs the funding wallet; universal gas sponsorship is not implemented.

## Required ENS receiving identity

For every new live distribution, recipients must link a Sepolia ENSv2 payment name and the sender must confirm its resolved profile. Reject raw IDs and incomplete name coverage; recheck before preparation, approval and submission. Keep recovery, claims and withdrawal available without a name so expiry cannot strand existing funds. This is an application constraint, not an immutable-contract or circuit invariant. Names and linked public profiles are public.

## Positioning
Private payouts inside your app. Allocation amounts and source-distribution identifiers are absent from claim public inputs. Deposits, withdrawals, ENS records and network/timing metadata remain public or observable. Never promise that no correlation or trace is possible.

## Brand Personality
Minimal and premium, as requested. Precise language and a quiet interface serve financial workflows.

## Design Principles
Keep the next action clear. Reveal technical detail progressively. Separate local sandbox activity from confirmed chain activity. Treat privacy failures as blocking. Keep recipient secrets on the recipient device.

## Entry and workspace flow
The public entry is a developer quickstart and read-only preparation example; it loads without Privy. The reference app authenticates before displaying private workspace content. On the first authenticated visit, ask for account type. Individuals choose an ENS payment name with the configured namespace suffix visible; full names are also accepted. Saving that preference neither registers a name nor publishes a profile. Individuals back up their keys and explicitly link/verify the name in their inbox. Both individuals and organizations select a Sepolia ENS identity. Organizations also keep an internal workspace label and see overview, payouts and treasury navigation. Wallet labels use current ENS address resolution or verified name ownership; ownership is labeled separately and never implies organization membership or a transfer destination. Organization identity is checked against the signer derived from its connected or restored policy. Unverified names, missing names, and unavailable lookups stay explicit. Wallet addresses and policy identifiers appear in expandable technical details. Withdrawals and editor grants accept confirmed ENS address records and recheck them before submission; withdrawals and removal of existing editor access retain a manual-address recovery path. A sending organization does not need to publish a receiving Payment ID.

## Withdrawal versions

The deployed v0.2 pool supports whole-note withdrawals. The new v0.3 source adds recipient-only partial withdrawals: a proof spends the original note, transfers the chosen public amount and inserts a new commitment for the hidden remainder. Full withdrawals retain the existing path. The client refuses partial withdrawals unless a v0.3 manifest and matching verifier are configured. There is no automatic migration of existing funds between immutable pools.

## Integration availability

The MIT-licensed npm developer preview is published as `@samarth208p/null-payouts@preview`. The internal workspace retains `@null-protocol/payouts`. It provides preparation, guarded approval/submission, explicit local or CRE compilation, multi-batch jobs and reconciliation. There is no hosted payout API. Wallet approvals and recovery prerequisites remain explicit; one Send action may still trigger multiple wallet prompts and transactions.

The choice personalizes the interface; it does not grant organization membership. Remember the choice per authenticated account in this browser. A type change preserves the current in-memory session. Sign-out or a different authenticated account disposes of private workspace state. Authentication does not restore private profile keys; clearly offer encrypted recovery.

## Accessibility & Inclusion
Keyboard access, visible focus, responsive layouts, readable text, and reduced-motion support are implementation choices for the reference app.
