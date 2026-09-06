# Local treasury approval

This CLI supplies the free local authorization path for the Sepolia application. It uses a separate treasury signer; the funded deployer pays only for public policy registration. It does not start a signing server or send payroll anywhere.

## Create and register the policy

After `pnpm setup:sepolia`, run:

```sh
pnpm treasury:init
```

The single root `.env` stores `NULL_TREASURY_SIGNER_PRIVATE_KEY`, `NULL_TREASURY_POLICY_METADATA`, and `NULL_TREASURY_REGISTRATION_BLINDER`. The last two values let a later initialization reconstruct the same policy import file. All three must be preserved together. The command writes `.artifacts/treasury-policy.json` with the signer public key and policy opening, restricts file access, and keeps it out of Git and public web assets. Neither the signer key nor opening values are printed.

After the NULL deployment is complete, review and send the registration:

```sh
pnpm treasury:register
pnpm treasury:register --broadcast
```

The first command checks the actual deployment and simulates the registration. The second uses the funded deployer, caps the transaction at 0.01 Sepolia ETH and the configured `NULL_MAX_FEE_GWEI`, and waits for three confirmations. Registration publishes only the policy commitment. An already registered policy is reused. A saved transaction journal allows the same transaction to be reconciled after an uncertain RPC response.

## Use the policy in the browser

1. Open the Sepolia workspace and unlock local encrypted recovery with a password.
2. In the live operation dialog, open **Organization policy and treasury notes**, choose **Import policy file**, and select `.artifacts/treasury-policy.json`.
3. Connect a browser wallet with Sepolia ETH and Circle test USDC. The local signer is independent of that wallet and does not need gas or tokens.
4. Shield test USDC under this policy, saving the encrypted note recovery before submitting. Wait for confirmation before preparing a distribution from the resulting treasury notes.
5. Review the distribution and select **Prepare live proof**. While approval is pending, open **Import an approval from your signing workflow**, select **Export public intent**, and copy the complete **Approval digest**.

Registration, token funding, shielding, distribution approval, and proof submission are separate actions. This CLI creates no private notes and does not deposit or distribute funds itself.

## Approve the reviewed distribution

Leave the browser's approval dialog open. Sign the exported file using its complete reviewed digest:

```sh
pnpm treasury:sign --input "C:/path/to/null-public-approval-intent.json" --digest 0xCOMPLETE_DIGEST_FROM_REVIEW
```

The command checks the exact fifteen public inputs, recomputes the digest, verifies the live Sepolia deployment, checks deadline and unspent treasury inputs, and confirms that the intent's authorization root includes this local policy. It signs the raw digest with a compact low-S secp256k1 signature; `personal_sign` is incompatible.

The result is written to `.artifacts/treasury-approval-<digest-prefix>.txt`, with its path printed. Open that file locally, paste its complete value into **Compact signature**, and select **Use this approval**. The signature is a private proof witness and is never printed by the CLI. An optional `--output .artifacts/approval.txt` selects a different ignored output; files containing different content are never overwritten.

Keep the same policy selected in the browser. An expired intent, changed draft, new proof attempt, different policy, or mismatched digest requires exporting and signing the new exact intent. After local proving finishes, review the public transaction and save encrypted recovery before submitting through the connected wallet or a configured relayer.

The CLI's checks and successful registration do not establish an end-to-end proof or payment result. This remains an unaudited testnet prototype without withdrawals.
