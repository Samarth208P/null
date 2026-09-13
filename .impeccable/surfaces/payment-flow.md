# Payment confirmation and ENS entry

Mode: Operate. Bounded refinement of the existing Soft Outline financial workspace.

## Direction contract

Preserve the incumbent Inter typography, pale material, raised controls, charcoal actions and semantic green. This is a focused improvement to an existing payment dialog and account setup, not a replacement visual world; no form seed or image comp was selected. Existing visual authority is `apps/web/src/styles.css`, `soft-outline.css`, and `output/production-flow-2026-09-13/payout-prepared.png` / `payout-confirmed.png` captured before this refinement.

First viewport: identify the amount, organization ENS and recipient ENS, show the current step in a six-step sequence, and explain the immediate task. Keep other technical details behind a disclosure. On narrow screens put From and To on separate rows so complete ENS names remain readable.

Signature interaction: a native focus-protecting dialog dims and blurs the workspace. Its current step changes with a short, already-visible text transition. An indeterminate line indicates active work without inventing a percentage. Yield to the wallet portal and restore the same dialog state afterward. Respect reduced motion.

## Implemented patterns

- **Payment hierarchy:** amount and real ENS From/To identities lead. Multiple distributions show the recipient count with the full name-and-amount list behind a disclosure. Claims use the truthful source label "Private payment" and explicitly identify the private NULL balance as the destination; an unavailable identity is never replaced with an invented name.
- **Six real stages:** Unlock, Choose funds, Approve & protect, Save backup, Confirm, Receipt. Non-distribution operations label the second stage Choose wallet; claims label the third Create proof. State comes from unlock, approval, proof preparation, recovery export, submission, reconciliation and confirmed receipts. A previous batch receipt must not skip the current batch's approval or backup stage.
- **Payment type hierarchy:** scoped dialog title 22px, amount 32px/550, ENS names 16px/550, current-step heading 20px/550, instructions 13px/1.7, and metadata 12px. At 600px and below, amount/name/current heading become 28/14/18px; step labels become 10px from 11px. The larger current-step block repeats the compact rail's information. These intentional values extend this surface only; detector advice based on the older global type ramp does not change the global typography contract.
- **Responsive dialog:** maximum width 720px, desktop padding 28px 32px, viewport-limited height, and sticky actions. At 600px and below, use 10px outer gutters and 22px 20px padding; stack From and To into separate wrapping rows and remove the arrow. ENS entry uses the shared entry layout with a 640px maximum width.
- **Depth and motion:** the native backdrop uses `rgb(26 34 43 / 44%)` with `blur(9px)`. Current-step headings move 3px over 180ms with `cubic-bezier(.16, 1, .3, 1)` and remain visible throughout. The 2px working line travels over 2.2s without representing measured progress. Reduced motion disables both animations and makes the line full-width and static; forced colors removes the backdrop blur and adds visible status/step borders.
- **Progressive detail:** optional sections explain current ENS checks, local proof generation, exact-batch Chainlink CRE local simulation, network visibility and the fee payer. Distinguish imported local simulation from remote enclave attestation. Sender knowledge, public deposits and withdrawals, the submitting address, timing, and observable network connections remain explicit.
- **Submission and receipt copy:** wallet submission requests the wallet action; relay submission names the payment service and says that it pays the network fee. Both await a confirmed receipt before claiming success. An unknown result asks for a status check before another send. Local preparation completion cannot say that nothing has been sent after a confirmed transfer; completed batches remain confirmed while subsequent transfers continue.
- **Collection and withdrawal:** explain before collection and on the receipt that collection creates a private NULL balance while USDC stays in the pool. Moving USDC to the wallet is a separate Balance → Withdraw action with a public amount and destination.
- **ENS entry:** verify the current name before opening private content, with recovery and linking available during setup. The organization name identifies the authenticated approval wallet; the individual name matches the connected wallet and original backed-up Payment ID. A fresh successful verification opens the workspace automatically. There is no extra Open button after success. Retry or unavailable checks retain an explicit status and next action.

## Quality bar

- The user can identify who is paying whom and what action is needed within seconds.
- Progress comes from real preparation, backup, submission and receipt states. An uncertain transaction is never described as successful or ready to resend.
- Explain local proof generation, ENS rechecks and exact-batch CRE local simulation in plain language. Never imply remote enclave attestation or complete anonymity.
- Collection adds a private NULL note; a separate withdrawal transfers USDC from the pool to the wallet publicly. State that distinction before collection and on its receipt.
- Require verified ENS linking before private workspace entry, including direct routes. The organization name must identify the authenticated approval signer, not a saved preference or gas wallet. The individual name must match a connected wallet and the original backed-up Payment ID.
- Preserve active proof and reconciliation state during wallet changes. Verify current identity again before payment actions.
- Check desktop 1440x1000, mobile 390x844, and the connected browser's 1280x720 viewport. No horizontal overflow; controls remain reachable by keyboard and scrolling.

## Evidence and boundaries

`.impeccable/review/desktop.png`, `mobile.png`, `user-1280.png`, `claim-receipt.png` and `relay-submission.png` render the real PaymentProgress and Modal components with clearly synthetic preview controls. `ens-gate-desktop.png` renders the gate with a synthetic authenticated session, but predates removal of the extra Open button; current `EnsAccessGate.tsx` is authoritative for automatic entry after verification. These do not claim a new live payment run. The existing real production distribution and user-submitted claim receipts are recorded separately in the local production-flow report.

Finish reviewer disposition: **ship** for the scoped payment refinement. Both material status-copy findings were resolved: relay submission names the service and fee payer, and preparation/backup completion preserves confirmed receipts and completed batches. This disposition does not review the concurrent encrypted Payment ID session-restoration work or its associated gate changes; the current gate entry behavior is documented from source only.

No unresolved aesthetic choice. Live ENS records remain external prerequisites and are not created by saving a name preference.
