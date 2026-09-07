---
name: NULL
description: A quiet financial workspace for private payments, adapted from Mercury.
colors:
  primary: "#5266eb"
  primary-hover: "#465bdb"
  primary-soft: "#282d49"
  primary-ink: "#b4bfff"
  canvas: "#171721"
  sidebar: "#111119"
  surface: "#1e1e2a"
  surface-hover: "#272735"
  ink: "#ededf3"
  secondary: "#c3c3cc"
  muted: "#aaaab9"
  line: "#32323f"
  line-strong: "#555565"
  focus: "#a7b2ff"
  success: "#97d6b3"
  success-bg: "#22382f"
  warning: "#e6c18c"
  warning-bg: "#3b3229"
  danger: "#ffacae"
  danger-bg: "#44292f"
  entry-canvas: "#171721"
  entry-panel: "#1e1e2a"
  entry-ink: "#ededf3"
  entry-secondary: "#c3c3cc"
  entry-muted: "#aaaab9"
  entry-line: "#32323f"
  entry-primary: "#5266eb"
typography:
  headline:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "28px"
    fontWeight: 400
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
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-.03em"
rounded:
  badge: "5px"
  navigation: "6px"
  input: "8px"
  panel: "12px"
  pill: "999px"
spacing:
  control-gap: "8px"
  compact: "12px"
  section-gap: "24px"
  panel-inset: "28px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#fff"
    rounded: "{rounded.pill}"
    padding: "8px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 17px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  badge-private:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
---

# Design System: NULL

## Overview

**Creative North Star: "A quiet financial workspace"**

NULL adopts the inspected Mercury dashboard's dark canvas, graphite surfaces, compact navigation, ivory text, and cobalt pill actions. Entry screens and Privy authentication use the same dark graphite palette with restrained periwinkle accents. This replaces the former white workspace direction.

The reference is a visual adaptation: NULL retains its name, slashed-circle mark, product content, existing transaction functions, and Privy email/wallet authentication. Locally hosted Inter substitutes for Mercury's custom Arcadia fonts. It is not a pixel-identical copy. The Operate surface contract and review evidence live in [the Mercury reference brief](docs/DESIGN_REFERENCE.md); durable product commitments live in [PRODUCT.md](PRODUCT.md).

**Key Characteristics:**

- Flat, restrained surfaces with thin boundaries and generous content gutters.
- Regular-weight headings, compact labels, and tabular financial values.
- A dark, focused entry sequence consistent with the workspace.
- Clear next actions and progressive disclosure of technical details.

## Colors

The workspace uses cool graphite neutrals with cobalt as its action accent. The frontmatter records current values from `apps/web/src/mercury.css`, which is imported after `styles.css` in `main.tsx` and overrides the earlier light palette.

- **Primary:** cobalt fills primary actions; pale periwinkle identifies links and private-state details. Soft indigo backs private-state badges.
- **Neutral:** the darkest rail separates navigation from the canvas. Graphite panels and slightly lighter hover fills establish grouping; ivory, secondary gray, and muted gray establish text hierarchy.
- **Semantic:** green, amber, and rose pair status text with tinted backgrounds. Keep visible status labels alongside color.
- **Entry:** entry and account setup inherit the dark workspace tokens. Privy uses its dark theme and a periwinkle accent.

## Typography

Use the locally hosted variable Inter family with the system fallbacks recorded above. Body copy is compact; table content and actions commonly use 13px, while supporting labels use the label role. Main headings use the headline role without heavy display styling. Entry headings use weight 450; section headings use restrained weights around 450–500.

Financial values use tabular numerals. The primary balance role reduces to 36px on mobile and 33px below 480px. Addresses and code retain the existing `SFMono-Regular`, Consolas, `Liberation Mono`, monospace stack. Keep the NULL wordmark and its slashed-circle geometry identifiable.

## Layout

The desktop shell has a fixed 224px sidebar, a 60px utility bar, and a main content region capped at 1560px with 35px top padding. Use the desktop gutter token for both the utility bar and content. Panels typically use 24–30px insets. The organization overview pairs treasury and draft-continuation panels, followed by recent distributions; its details belong to the surface brief.

At 1200px, content gutters reduce to 30px. At 1080px, the overview and distribution wizard collapse to one column. At 760px, navigation becomes a 260px dismissible drawer, the utility bar becomes 64px tall, and content uses 20px gutters. Below 480px, content gutters reduce to 18px. Tables retain local horizontal scrolling.

Entry screens use balanced outer grid rows so the panel centers vertically when space allows and scrolls on short screens. The sign-in panel is at most 464px wide; account setup is at most 512px wide. Panel content is left aligned, with the NULL brand at the upper left of the page. Mobile panels reduce their width and padding.

## Elevation & Depth

Workspace panels are flat: background tone and one-pixel boundaries provide separation. The native modal uses a dark translucent backdrop and a slightly lighter panel. A dark toast with a diffuse shadow provides temporary feedback. Avoid adding decorative shadows to resting financial panels.

Motion remains brief and functional: controls respond over 160ms, entry content appears over 220ms, and organization fields and the mobile drawer transition over 200ms. Keyboard focus removes entry transitions; reduced motion removes transition delays and spatial effects. Exact extensions are recorded in `.impeccable/design.json`.

## Shapes

Use pill buttons, circular icon controls, gently rounded panels, and smaller input, navigation, and badge corners from the frontmatter. Thin borders define inputs and financial containers. Line icons support visible labels; the custom slashed-circle mark remains the brand's distinctive geometry.

## Components

- **Buttons:** primary actions use cobalt with white labels; secondary actions use graphite fills; ghost actions remain quiet. Desktop buttons have a 38px minimum height, while compact utility controls are smaller. Mobile utility and form actions expand to at least 44px. Press feedback applies only when it does not interfere with keyboard focus or reduced motion.
- **Fields:** dark inset fields use a strong border, visible labels, inline errors, and a two-pixel focus outline. The minimum desktop height is 43px; mobile editable fields use 16px text and at least 44px height. Read-only fields use the hover surface tone.
- **Navigation:** compact rows have a filled active state and `aria-current`. The mobile drawer traps focus, makes the workspace inert, closes on Escape, and returns focus to its opener. Preserve the skip link and focus movement on route changes.
- **Panels and tables:** use the shared surface and panel radius. Tables use subdued headers, row dividers, hover feedback, and tabular amounts. Missing or unrecovered balances display an unavailable state, not a fabricated zero; balance masking also covers related totals.
- **Entry and account selection:** show the real Privy sign-in action, then full-label individual/organization radio options. Reveal organization naming only when selected. Keep the separate encrypted recovery explanation visible; selecting a workspace type does not grant organization authorization.
- **Status and disclosure:** identify Ethereum Sepolia in connection settings, local-versus-confirmed publication wording, semantic badges, and expandable technical and recovery details. Public privacy boundaries retain their existing confirmations.

## Do's and Don'ts

- **Do** extend the current dark palette across the workspace, entry screens, and authentication.
- **Do** preserve NULL branding, real data, authentication, recovery, financial actions, visible focus, and reduced-motion behavior.
- **Do** keep amounts legible, masked consistently when requested, and paired with accurate recovery or transaction status.
- **Don't** restore the old white workspace or square off the current pill actions.
- **Don't** import Mercury banking copy, password forms, invented performance history, or unsupported product claims.
- **Don't** describe the adaptation as pixel-identical or treat a visual review as a complete accessibility or transaction audit.
