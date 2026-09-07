# Confidential Workflows access form

These are paste-ready answers for the [official access form](https://docs.chain.link/cre/account/confidential-workflows-access). This document has not been submitted automatically.

## CRE organization ID

```text
org_rErynYyKp1Ee69aw
```

This is the existing account verified with `cre whoami`. If you create a separate account as suggested by the form, use the new account's organization ID instead.

## Describe your use case and what data needs to remain confidential

```text
I am building NULL, a privacy-preserving payroll and distribution prototype on Ethereum Sepolia.

The proposed CRE workflow uses an authenticated HTTP trigger to fetch an immutable payroll batch inside a confidential execution environment. It validates the batch and produces eight encrypted recipient envelopes and public commitment roots for the application.

Recipient payout amounts, internal recipient references, unpublished payroll data, secret batch entropy, and the payroll API credential must remain confidential. The trigger contains only a batch identifier and expected commitment roots. The intended workflow output contains encrypted envelopes and public commitments, without plaintext payroll details.

Initial testing uses synthetic data and testnet assets only.
```

## Additional context

```text
This is a TypeScript development/demo integration using Ethereum Sepolia, with the web application running locally. The confidential HTTP workflow now passes an actual local CRE simulation: it fetches an authenticated synthetic payroll fixture and returns encrypted output matching an independent local compilation. Remote confidential execution, attestation, and deployment have not been verified. A standard CRE deployment-access request has already been submitted.

I am requesting Confidential Workflows access and a free testnet/demo allowance. Please confirm the available usage limits and whether the Chainlink-hosted private registry supports this confidential workflow. The project must remain free to operate during testing; please do not enable paid usage.

This integration does not require mainnet deployment or real payroll data.
```
