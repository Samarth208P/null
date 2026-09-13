# Finish the owner-approved Sepolia rehearsal

The software is prepared for the owner to sign. No owner-approved public payout is claimed yet. Use one real recipient and one payout throughout the recording; the synthetic CRE and local-chain tests are separate evidence.

## Prepared two-account demo — September 13

Use [the hosted reference app](https://null-protocol.netlify.app/#/demo) in two separate browser profiles, or two different browsers. Two normal tabs share the login and encrypted funds storage. Keep each profile open and save both accounts' encrypted backups before recording.

| Role | Prepared account | What to do before recording |
| --- | --- | --- |
| Organization | Existing Privy owner account; funding wallet `0x7fD5B5B80E9F7a811b1d27Ec20879185fB987433` | Choose Organization, name it **Demo Studio**, fund this wallet with **10 test USDC** and approximately **0.01 Sepolia ETH**, then complete Add funds for 10 USDC. |
| Individual | MetaMask account `0xA888d19eD7AC6AbCb59DA2122085767613bC2FCB` | Choose Individual, enter **demo**; the field adds `.nullpay2026.eth`. Save the recipient backup and sign **Link name**. |

The dedicated Privy organization approval wallet is `0x6567226D425c423b1A5765384Ae343aE5FDeB1d1`. It signs organization intents. The table identifies the separate wallet intended to make the public deposit; confirm that address in the Add funds dialog.

The recipient owns **demo.nullpay2026.eth** and has permission scoped to its `null.paymentProfile` record. [Name assignment](https://sepolia.etherscan.io/tx/0x00c04c9ec5ea048a3fb9e19e52071684aa6f766960a0b0a72a6d76a3e02e1078) and [record permission](https://sepolia.etherscan.io/tx/0x08f69cce59676f6a836cde7aa3dadfbec7a1d9812244872d1461c65e22a61d3d) were confirmed. These are setup transactions; the recipient must still publish its own receiving profile. The former `inbox.nullpay2026.eth` assignment is retained for its original owner and is not this demo's destination.

Suggested recording payment: **1 test USDC** to **demo.nullpay2026.eth**, from the prefunded 10 USDC organization balance. Prepare the name link, organization activation and deposit before filming. During filming, show the existing organization balance, prepare and approve the 1 USDC payout, switch to the recipient, collect it and show the public receipt evidence. A whole-note withdrawal of that received note is 1 USDC and public.

For proof tabs, use **Download transaction receipts** from this actual payout and its claim/withdrawal, then open each exported transaction's Etherscan link. On distribution **Logs**, point to eight encrypted `EnvelopePublished` events. On claim calldata/logs, point to commitments, root and nullifier, with no explicit allocation amount or specific source-batch identifier. On withdrawal **Token Transfers**, point to the public destination and amount. The [shooting script](SUBMISSION_DEMO.md) has the exact narration and limitations. No payout hash exists until the owner signs and the transaction confirms.

After the user's funding transfer, the organization funding wallet was checked at **50 test USDC and 0.1005 Sepolia ETH**. The recipient also has sufficient gas and tokens. These are wallet balances; the 10 USDC pool deposit, recipient profile publication and owner-approved payout still require the user's signatures. Refresh the hosted app before starting the repaired flow.

## Open the prepared app

From the repository root, run `pnpm dev:all` if the services are not already running. Open [the local reference app](http://127.0.0.1:5173/#/demo). The organization API, relayer and configured payroll service start alongside the web app. This uses existing local configuration; no secret belongs in a screenshot or submission file.

The local reference app includes the local CRE and sending services. The [public app](https://null-protocol.netlify.app/#/demo) uses its hosted organization API and connected-wallet submission unless a public relayer is configured; see [hosted release status](NETLIFY_SUBMISSION.md). Keep the app on Ethereum Sepolia and use test tokens.

## Recipient: publish the actual receiving profile

1. Sign in as `0xA888d19eD7AC6AbCb59DA2122085767613bC2FCB`, which owns `demo.nullpay2026.eth`. The setup check confirmed ownership and payment-record permission, with the profile still unpublished.
2. Choose Individual and open Inbox. If returning to an existing Payment ID, choose **Restore backup** first. Otherwise enter `demo` (the suffix is shown) or `demo.nullpay2026.eth` and choose **Continue**. NULL checks connected wallets and selects a permitted owner or editor automatically. If none can update the name, use **Connect another wallet**, then **Check wallets again**.
3. Choose **Save backup and continue**, set a password and download the encrypted file. The same setup advances to **Link your name**. Review the public-record notice, consent and choose **Link name**. Approve the Sepolia record update in your wallet and wait for **Your inbox is ready**. An existing restored backup skips the save step; a new identity cannot recover payments addressed to old keys.
4. Save the transaction link. After linking, open **Advanced: payment record access**, enter the wallet whose permissions you want to inspect and choose **Check access**. The two-record comparison reads Sepolia and offers **Download permission check**. It makes no changes. A revoked verification editor can be shown using the existing setup evidence; do not grant new access simply to get a screenshot.

The `receive` and `pay` names in automated checks are verification fixtures. They are not recipient accounts to fund.

## Organization: establish approval and fund the pool

1. Sign in as the configured organization approver, choose Organization and open Funds → Add funds. Choose a small test amount you intend to use and acknowledge the public deposit.
2. Unlock the funds backup. Restore the organization's existing encrypted funds backup if one exists.
3. In the now-visible **Organization setup**, select **Use Privy organization**. Approve the identity-only request; this does not authorize a payment.
4. Choose **Save organization backup**, then **Activate organization setup**. An existing setup is recognized; a new one needs a Sepolia transaction. If the transaction is unresolved in this dialog, **Check activation** waits for that transaction rather than submitting it again. Keep the activation link if you reload or leave the page.
5. Prepare the deposit, download its recovery backup, then confirm the deposit in the funding wallet. The wallet needs test USDC and Sepolia ETH for its transactions. Download the confirmed transaction receipt and the updated funds backup before closing.

## Pay, verify and approve the same draft

1. Start New payment and add the recipient's confirmed inbox name and intended test amount. Resolve and confirm the receiving profile. Keep **Verify with Chainlink CRE (local simulation)** enabled.
2. Export the private input. Run `pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"` locally. The path is to the downloaded private export; keep its contents off-screen.
3. Import the printed output directory's `payment-result.json`. A wrong batch or altered output leaves review locked; the exact result unlocks it. The success message identifies the batch, network, pool and envelope checks. This is local simulation, with no remote enclave attestation.
4. Review, choose Send payout, unlock the organization funds and select the available balance. Prepare the payment, then choose **Approve with organization** for the actual payment intent. This is the financial approval, separate from step 3 in organization setup.
5. Download the updated funds backup and confirm the payment. Use the configured sending service or your connected wallet. Wait for confirmation; use **Check transaction status** if the result is uncertain.
6. Choose **Download transaction receipts** before closing. The export contains public transaction references and labels the app-observed approval source as `privy-owner` or `imported`. It excludes names, private amounts, keys, signatures and note recovery data. It is not independent proof of Privy provenance; keep the redacted owner-approval recording too.

## Recipient: finish the same payment

1. Return to the recipient account with its original Payment ID. Discover the payment and collect it with the local proof flow.
2. Download the claim receipt and updated encrypted recovery backup before closing.
3. Open the recipient balance, choose Withdraw and select the received note. The current public pool supports whole-note exits. Review the public receiving wallet and amount, prepare, save the backup and confirm.
4. Download the withdrawal receipt. The public exit reveals its amount and address. Avoid sharing a single artifact that gratuitously links private recipient identities to claims.

## Finish the submission

Record the [human-narrated demo](SUBMISSION_DEMO.md), attach the actual public distribution/claim/withdrawal hashes and add observed video timestamps to the [sponsor evidence guide](SPONSOR_EVIDENCE.md). Keep an encrypted recovery file private; only the explicitly public receipt exports belong in public evidence. Record the demonstrated source revision and deployed release. Update pending claims only after those actions actually succeed.

Publishing the SDK and website is separate from completing the owner-approved payment. Local proofs, test signatures, deployment and configuration checks must never be presented as that payment.
