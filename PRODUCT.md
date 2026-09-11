# NULL

## Register
product

## Platform
web

## Users
Finance administrators prepare confidential distributions, organization approvers authorize them, and recipients discover entitlements and hold private notes. Integrators inspect public protocol state. These audiences and workflows come from PRD.md sections 8, 45–49, and 67.

## Product Purpose
Private distribution infrastructure for Ethereum, with payroll as its first application. The product connects a shielded treasury, fixed eight-slot allocations, encrypted recipient delivery, and entitlement claims against a global distribution accumulator.

## Required ENS receiving identity

For every new live distribution, recipients must link a Sepolia ENSv2 payment name and the sender must confirm its resolved profile. Reject raw IDs and incomplete name coverage; recheck before preparation, approval and submission. Keep recovery, claims and withdrawal available without a name so expiry cannot strand existing funds. This is an application constraint, not an immutable-contract or circuit invariant. Names and linked public profiles are public.

## Positioning
Distribute value, reveal nothing. Privacy claims apply inside the proposed private protocol zone; entry, exit, network metadata, and employer knowledge have explicit boundaries.

## Brand Personality
Minimal and premium, as requested. Precise language and a quiet interface serve financial workflows.

## Design Principles
Keep the next action clear. Reveal technical detail progressively. Separate local sandbox activity from confirmed chain activity. Treat privacy failures as blocking. Keep recipient secrets on the recipient device.

## Entry and workspace flow
Authenticate with email or wallet before displaying workspace content. On the first authenticated visit, ask whether the user is an individual or an organization. Individuals start in their inbox and see private balance navigation. Organizations name their workspace and see overview, distributions, and treasury navigation. Help, privacy explanations, and account settings are shared secondary destinations.

The choice personalizes the interface; it does not grant organization membership. Remember the choice per authenticated account in this browser. A type change preserves the current in-memory session. Sign-out or a different authenticated account disposes of private workspace state. Authentication does not restore private profile keys; clearly offer encrypted recovery.

## Accessibility & Inclusion
Keyboard access, visible focus, responsive layouts, readable text, and reduced-motion support are implementation choices for the reference app.
