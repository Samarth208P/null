# Local note: HTTP trigger example in the installed CRE skill

This draft is kept locally; no issue has been uploaded or posted.

Repository: `smartcontractkit/chainlink-agent-skills`

Title: `[CRE] Correct TypeScript HTTP trigger payload and authorized keys`

Suggested labels: `agent-feedback`, `skill:cre`, `kind:gap`

Skill: `chainlink-cre-skill`, version `0.0.22`.

The TypeScript HTTP example in `references/triggers.md` uses `HTTPTriggerPayload`, a parsed `body`, and `authorizedKeys: string[]`. The official current HTTP guide and the installed template SDK 1.18.0 use `HTTPPayload`, byte input in `payload.input`, and authorization objects containing `type: "KEY_TYPE_ECDSA_EVM"` and `publicKey` as an EVM address. The guide explicitly allows `trigger({})` only for simulation.

Suggested fix: update the TypeScript example and payload table to match the documented SDK types, and avoid logging an entire request body in examples involving confidential workflows.

Reproduction: request a TypeScript confidential payroll workflow with an HTTP trigger, scaffold the official confidential template, and typecheck an adaptation of the skill's HTTP example.

Authoritative source consulted: [HTTP trigger configuration and handler](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/configuration-ts).

Agent metadata: Codex desktop, Windows; CRE CLI 1.32.0, template SDK 1.18.0.
