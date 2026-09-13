# Individual withdrawal amount

Mode: Operate. Bounded extension of the existing Soft Outline withdrawal dialog.

## Direction contract

Inherit `DESIGN.md` and the existing payment dialog: pale material, inset outlined fields, Inter typography, charcoal primary action, visible focus and semantic notices. Keep the amount decision inside the current modal without adding a new visual system or global tokens.

The user chooses how much USDC to withdraw, sees what they will receive and what stays in NULL, then prepares the withdrawal. Retain the receiving-wallet control and the explicit notice that the withdrawn amount and receiving address become public.

## Implemented patterns

- **Explicit amount:** a labeled decimal input accepts a positive USDC amount with up to six decimal places. It starts empty. “Use full balance” fills the exact available amount and is unavailable for a zero balance.
- **Decision context:** available private balance precedes the input. Valid entries show “You receive” and “Stays in your private balance” beneath it, using the existing financial rows. The helper text explains the decimal limit and that the remainder stays in NULL.
- **Multiple transfers:** when the plan contains more than one transfer, a notice gives the count, explains that each needs confirmation, and states that stopping preserves completed transfers while the rest stays in NULL.
- **Validation:** empty, malformed, zero, excessive-precision and over-balance entries block preparation. Nonempty invalid input receives visible status text and an invalid-field state. Over-balance errors give a next action without including the available amount. Preparation also checks the computed error before creating a withdrawal plan.
- **Hidden balances:** the workspace preference masks available balance, receive amount and remainder. Validation copy must preserve that preference. The amount the user types remains editable and visible.
- **Locked plan:** disable amount changes while busy, after preparation or once transfer progress has begun. Keep the inherited modal scrolling, action row, keyboard focus and reduced-motion behavior.

## Evidence and boundaries

Source: `apps/web/src/components/WithdrawalAmountField.tsx`, `apps/web/src/lib/withdrawal-amount.ts` and its integration in `apps/web/src/components/LiveOperation.tsx`.

`.impeccable/review/withdrawal-desktop.png` and `withdrawal-mobile.png` show the real field in a synthetic modal preview, including a 0.9-USDC choice from a 1.3-USDC balance and the two-transfer notice. `withdrawal-hidden-validation.png` and `withdrawal-hidden-validation-mobile.png` record the masked over-balance error. These captures demonstrate the scoped presentation; they are not evidence of a live withdrawal.

The initial finish review found one hidden-balance disclosure in validation copy. Its follow-up verdict scored that single fix resolved with disposition **ship**; the verdict did not verify live payment execution.

The amount-entry path is gated by the manifest's partial-withdrawal capability for individual withdrawals. Other withdrawal paths retain the existing note selection. This document records source UI behavior and does not establish deployment availability or migration of existing funds.
