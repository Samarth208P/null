# Mercury reference for NULL

The reference selected on September 6, 2026 is [Mercury on Refero Styles](https://styles.refero.design/style/3172cd4d-118a-4a16-a259-6b634d32322e). Its business and personal account structure fits NULL's organization and individual workspaces. The live [Mercury dashboard demo](https://demo.mercury.com/dashboard) and [login screen](https://app.mercury.com/login) were also inspected to ground the implementation in working product screens.

## Surface contract

Mode: Operate. Retain NULL's authentication gate, account selection, role-specific navigation, data, recovery, privacy boundaries, and all existing transaction actions. Apply the reference's visual language throughout these workflows.

The workspace uses Mercury's dark canvas, graphite panels, compact navigation, thin borders, ivory type, and cobalt pill actions. The overview pairs its treasury with actionable drafts, then lists recent distributions. All amounts and counts come from the existing store; no synthetic performance chart is presented as financial history.

Entry screens follow the live login's pale lavender canvas and centered white panel. NULL uses its existing Privy email/wallet flow. It does not add Mercury's password form, banking services, marketing claims, or account-opening links. The NULL wordmark and product copy stay identifiable.

The reference's custom Arcadia fonts are replaced by locally hosted Inter. This is a close visual adaptation to NULL's actual functionality, not a pixel-identical copy of Mercury's pages. Source screenshots calibrate typography, spacing, density, and control treatment; they are not shipped as interface elements.

## Verification boundaries

Preserve the 760px mobile navigation breakpoint, keyboard focus trap and Escape dismissal, reduced-motion behavior, balance masking, and explicit Sandbox/Sepolia labeling. Never replace missing or unrecovered balances with zero, or describe local publication as a confirmed transaction. Sign-in does not restore private profile keys.

Browser checks completed for the sign-in page and Privy dialog, account selection, individual inbox, the organization overview, a draft form, settings, and mobile navigation. Balance masking was checked against the treasury, pending total, and distribution amounts. The mobile drawer retained focus, made the workspace inert, and restored focus to its opener on Escape. The original Individual/Sepolia preferences were restored after using sandbox sample data for review.

`pnpm build` (TypeScript and Vite), all eight existing account/route tests, and `git diff --check` passed. Financial actions and onchain transactions were not exercised. Reduced-motion handling is retained in source; system-level reduced-motion emulation was not run. Viewport screenshots are stored locally under `.research/mercury-review/`; the full-page capture API produced malformed images, so the review uses normal viewport captures.
