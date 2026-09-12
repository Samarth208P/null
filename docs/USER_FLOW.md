# Authentication and workspace flow

1. NULL waits for Privy to restore an existing session. New visitors see only a sign-in page, including when opening a direct link to a workspace route. Email and wallet authentication use the existing Privy provider. Without a configured provider, the page explains that sign-in is unavailable; there is no guest bypass.
2. Authenticated users without a saved preference choose Individual or Organization. Organization users also enter a workspace name. No type is preselected on the first visit.
3. Individuals open their inbox, link and share an ENS receiving name, check for payments, and collect them into their Balance. Organizations open an overview of their Funds and Payments, then prepare and review a payment.
4. Settings contain account type, backups, balance visibility, and explicit sign-out. Test mode and connection controls live under Advanced settings. Help explains how to send, collect, and keep access to payments, with the relevant privacy and withdrawal limits.

## State and authorization

The inbox opens its setup inline: **Choose name → Save backup → Link name**. Checking a name reads connected-wallet permissions and prefers its owner when authorized; it never assumes that the first Privy wallet can update the name. Missing access has a connect-and-recheck action. Read failures ask for a retry instead of selecting an unverified wallet. Wallet details are collapsed, and permission editing appears under Advanced only after linking.

Short names include the deployed namespace suffix automatically. A parent resolver answering for an unassigned child is not proof of ownership: inbox setup stops before checking wallets when the owner is the zero address. It explains that the parent owner must assign the name and checks the deployment's configured recipient assignment and saved name choices for an alternative. **Find my assigned NULL name** uses those candidates, not a complete ENS index; each suggestion must still belong to a connected wallet and permit a payment-record update on Sepolia. Selecting it performs a fresh lookup before continuing. A connected owner without resolver permission gets a permission-specific explanation. Read-only ENS alias resolution remains supported.

The backup action opens the existing encrypted recovery form and returns to the same setup. Restoring preserves the typed name while requiring a new lookup and publication consent for the restored identity. Linking requires explicit consent, a matching connected account, the existing write preflight and a wallet transaction. Confirmation keeps the success state, copy action and transaction link visible. No wallet is granted new permissions automatically.

Only the workspace preference is saved in local storage, under a versioned key scoped to the authenticated Privy ID. Invalid preferences return the user to onboarding; unavailable storage permits the current session and displays an explanation. Private keys, drafts, and balances retain the existing in-memory lifecycle. Changing workspace type preserves them. Sign-out, account replacement, and page reload discard the in-memory workspace.

Sign-in does not restore receiving keys. Encrypted recovery is available in the inbox and Settings; the sign-out confirmation explains the loss of unsaved state. Existing organization membership, wallet ownership, treasury policy, and server authorization checks remain authoritative. Choosing an organization workspace never authorizes a transaction.

Direct hashes are normalized to destinations supported by the chosen experience. This is a navigation rule, not an authorization mechanism. Existing diagnostic routes remain available by direct link after authentication; everyday navigation does not promote them.

## User-facing language

Use Payments, Funds, Balance, Payment ID, Collect payment, Save backup, and Restore backup consistently. A Payment ID is the public receiving profile, not a wallet address. Name the backup's contents when needed: Payment ID backup and Funds backup restore different things.

Show Practice mode and Test network in the interface, while retaining existing `sandbox` and `testnet` state values. Show Prepared as Ready to send, Published locally as Sent in practice, and Confirmed as Sent. Never label a prepared or uncertain payment as sent.

Keep proof, commitment, envelope, padding, and connection diagnostics out of the normal payment and inbox screens. Preserve the facts needed to act safely: this version uses test money, deposits are public, withdrawals reveal the receiving address and amount, unsaved local state can be lost, and signing in does not restore Payment ID keys. Keep necessary organization approval inputs under Advanced setup; simplifying the display must not change the approval checks.

## Design references

- [Hick’s Law](https://lawsofux.com/hicks-law/): two initial choices, then navigation limited to relevant tasks.
- [Goal-Gradient Effect](https://lawsofux.com/goal-gradient-effect/): onboarding shows completed sign-in and the remaining workspace choice.
- [Laws of UX](https://lawsofux.com/): group related tasks, make important actions easy to recognize, and reveal details when needed.
- [Emil Kowalski’s design engineering skill](https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng): deliberate press feedback, short transitions, keyboard focus, touch-sized controls, and reduced-motion alternatives.

## Validation

Run `pnpm --filter @null-protocol/web test` for profile parsing, saved-account isolation, and role route rules. Run `pnpm --filter @null-protocol/web build` for TypeScript and production compilation.

For browser validation, check logged-out direct links, login cancellation, first-use choices, both workspaces, role changes without losing receiving identity, persisted names, sign-out, narrow viewports, and keyboard navigation. Use isolated test sessions for session replacement; do not add a production authentication bypass.
