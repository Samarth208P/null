# Developer documentation

Mode: Read. Extend the existing developer surface and Soft Outline visual system.

Audience: developers embedding NULL in an existing browser product; backend sponsors and AI assistants are secondary paths. The user explicitly selected browser integration first.

Structure: existing landing introduction leads into browser quickstart, payout lifecycle, recipients/recovery, gas sponsorship, API imports, privacy/deployment, searchable questions, and a downloadable self-contained skill. Guides have direct hash routes, shared header, side navigation, focused article heading and a next step. Mobile navigation becomes an in-flow two-column list. The reference app stays separate and functional.

First viewport: quiet documentation navigation beside a readable article, clear installation command, real package name and current preview/testnet state. Preserve Inter, gray material, charcoal controls, code-panel depth and the exact logo. No new visual identity, image comp or decorative media.

Behavior: keyboard-visible focus, copy feedback and failure text, searchable guide/FAQ empty states, semantic disclosures, downloadable SKILL.md and deep links that survive reload. Correctness includes explicit host callback requirements and honest privacy and deployment boundaries.

Implemented reading layout: articles are capped at 850px with prose capped at 72ch. The sticky desktop guide navigation becomes an in-flow two-column list at 760px. Article headings use 36px on desktop and 30px on mobile; code and API tables scroll within their own keyboard-focusable regions. The current guide uses inset depth and `aria-current="page"`. These are documentation-surface decisions within the existing system, not changes to the global identity.
