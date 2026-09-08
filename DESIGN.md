---
name: NULL
description: Soft Outline, a quiet financial workspace with tactile light surfaces.
colors:
  primary: "#20252b"
  primary-hover: "#343e48"
  primary-soft: "#dfe5eb"
  primary-ink: "#303c49"
  canvas: "#edf0f3"
  surface: "#edf0f3"
  surface-hover: "#e3e8ed"
  ink: "#20252b"
  secondary: "#49545f"
  muted: "#58636e"
  line: "#ccd3da"
  line-strong: "#7d8995"
  focus: "#365976"
  success: "#236047"
  success-bg: "#e0eee6"
  warning: "#795119"
  warning-bg: "#f3ebdb"
  danger: "#a1303e"
  danger-bg: "#f5e3e6"
typography:
  headline:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "30px"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-.03em"
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontSize: "12px"
  balance:
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-.03em"
rounded:
  badge: "5px"
  tab: "8px"
  control: "10px"
  inset-panel: "12px"
  panel: "16px"
  modal: "18px"
spacing:
  control-gap: "8px"
  compact: "12px"
  section-gap: "24px"
  panel-inset: "30px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#fff"
    rounded: "{rounded.control}"
    padding: "8px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 17px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  badge-private:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
---

# Design System: NULL

## Overview

**Creative North Star: "Soft Outline"**

NULL combines crisp Outline structure with the stronger neumorphic treatment approved by the user: pale gray material, charcoal type, raised surfaces, and inset controls. Financial information stays compact and legible, with generous gutters and clear next actions. Authentication, inbox, funds, dialogs, and settings share this light visual system.

The current authority is `apps/web/src/soft-outline.css`, imported after the structural and responsive `styles.css` by `main.tsx`. The outgoing Mercury stylesheet is replaced. `docs/DESIGN_REFERENCE.md` is a historical reference, not current design authority. Durable product commitments remain in `PRODUCT.md`.

**Key Characteristics:**

- One pale material with a consistent upper-left light source.
- Charcoal actions, clear field outlines, and readable semantic status labels.
- Raised task panels and controls alongside flat financial tables.
- The supplied six-blade aperture logo and restrained Inter typography.

## Colors

Pale gray canvas and surface share the same material; charcoal anchors text, primary actions, and the logo. Secondary and muted text remain distinct from low-contrast borders. Strong outlines use `line-strong`, and keyboard focus uses the blue-gray `focus` token.

Green, amber, and red status treatments pair color with visible labels. Private-state badges are neutral outlined labels. Entry screens inherit the workspace palette; Privy uses its light theme with the charcoal primary accent.

## Typography

Use locally hosted variable Inter with the frontmatter fallbacks. Main headings use 30px/550; mobile headings use 28px. Entry headings use 28px/550, reducing to 27px on small screens. Section headings are typically 18px with restrained 450–500 weights; body text is 14px, table text and actions 13px, and supporting labels 12px. Badges use 11px/500.

Financial values use tabular numerals. The main balance uses 40px/500, reducing to 36px at mobile and 34px below 480px. Addresses and code retain `SFMono-Regular`, Consolas, `Liberation Mono`, monospace. The NULL wordmark uses 21px Inter at weight 650.

## Layout

The desktop shell has a 224px sidebar, a 72px utility bar, and content capped at 1480px with 38px top padding and 40px horizontal gutters. At 1200px gutters reduce to 30px. The overview treasury spans the content width, with balance information on the left and a divided ledger on the right; compact draft continuation follows below. At 1080px the ledger stacks below the balance and the distribution wizard becomes one column.

At 760px navigation becomes a 260px dismissible drawer, the utility bar is 68px tall, and content uses 28px top padding and 20px gutters. Below 480px gutters reduce to 18px. Panels generally use 24–32px insets, reducing to 22px for treasury, draft, and wizard panels on small screens. Tables and filter tabs scroll locally where needed.

Entry panels center vertically when space permits and scroll on short screens. Sign-in is at most 480px wide; account setup is at most 512px. Left-aligned content uses 44px desktop padding, 32px on mobile, and 30px 24px below 480px. The brand remains at the upper left.

## Elevation & Depth

The user's explicit Outline plus stronger Neumorphism direction is a deliberate exception to generic no-shadow defaults. Resting task panels and secondary controls are raised; fields and selected account options are inset. Keep one light source and the shared pale material. Shadows supplement visible text, outlines, and selected-state semantics.

- `--raised`: `9px 9px 22px #cdd4dc, -9px -9px 22px #ffffff`; principal task panels. At 760px: `6px 6px 16px #cdd4dc, -6px -6px 16px #fff`.
- `--raised-small`: `4px 4px 9px #cbd3dc, -4px -4px 9px #ffffff`; controls, active navigation, and compact supporting surfaces.
- `--inset`: `inset 3px 3px 7px #cdd5de, inset -3px -3px 7px #ffffff`; fields, pressed secondary actions, and inset content.
- `--primary-shadow`: `4px 5px 10px #c4ccd5, -3px -3px 8px #ffffff`; charcoal and danger actions.

Tables remain flat with dividers. Dialogs use a separate diffuse shadow and translucent charcoal backdrop; toasts use charcoal with white text. Keep short functional motion and preserve the existing reduced-motion and keyboard-focus safeguards. Exact overlay and motion values are in `.impeccable/design.json`.

## Shapes

Controls and active navigation use 10px corners, raised panels 16px, inset content and account options 12px, and dialogs 18px. Badges retain 5px corners and a visible border. Use line icons with labels.

Preserve the exact supplied six-blade aperture geometry. The UI mark inherits `currentColor`; the original black `public/logo.svg` remains intact. Keep it static without gradients, glow, or rotation.

## Components

- **Buttons:** charcoal primary and red danger actions have white labels and the primary shadow. Secondary actions are pale raised controls that become inset when pressed. Disabled actions lose their shadow and retain readable muted text. Standard buttons are at least 42px tall; desktop utility actions are 38px, mobile actions 44px, and entry continuation 48px.
- **Fields:** 46px minimum height, strong one-pixel outline, inset shadow, 10px corners, and visible labels. Mobile editable text is 16px. Keyboard focus has a two-pixel outline. Read-only and disabled fields omit the inset shadow.
- **Navigation and filters:** active routes and selected tabs are raised, with semantic selected states. The mobile drawer retains its focus trap, inert background, Escape dismissal, and focus return. Preserve the skip link and route-change focus.
- **Panels and tables:** shared raised surfaces group treasury, drafts, wizard, inbox, funds, and entry tasks. Flat tables use dividers, hover feedback, and tabular amounts. Unavailable balances remain explicit, and masking covers related totals.
- **Entry and accounts:** real Privy authentication leads to labeled individual/organization options. Selected options use charcoal outlines and inset depth. Organization naming is progressively revealed. Preserve the encrypted recovery explanation and authorization boundaries.
- **Dialogs and settings:** use shared fields, semantic status text, inset recovery content, and raised actions. Keep Ethereum Sepolia identification, local-versus-confirmed publication wording, and technical disclosure accurate.

## Do's and Don'ts

- **Do** extend Soft Outline consistently across all routes and authentication.
- **Do** use the shared raised and inset tokens; retain flat financial tables.
- **Do** preserve the exact logo, real data, authentication, recovery, focus, reduced motion, and financial behavior.
- **Don't** restore the dark Mercury palette or cobalt pill actions.
- **Don't** rely on soft shadows alone to communicate controls, focus, or status.
- **Don't** invent balances, history, banking copy, or unsupported privacy claims.
- **Don't** equate visual checks with live authentication or transaction verification.

Validation for this revamp: build, typecheck, and eight account tests passed. Fifty route/viewport captures at 1440, 768, 390, and 320px using simulated sessions showed no page overflow or page errors; draft, filter, and modal checks ran at 1440 and 390px. Live authentication and transactions were not verified.

### Quiet interaction feedback

Controls change color and depth over 140ms; primary actions press down by 1px. Navigation and filter selections use the same timing. Inputs transition their outline color without moving. The account menu enters over 180ms with a 3px offset; dialogs and feedback toasts use 180ms and a 4px offset. Entry content has only a slight opacity transition, with no blur. The logo, financial values, panels, and page content remain still. Reduced-motion settings remove these transitions and positional effects while preserving immediate state feedback. No motion dependency is added.
