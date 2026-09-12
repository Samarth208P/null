# Finish the owner-approved Sepolia rehearsal

The software is prepared for the owner to sign. No owner-approved public payout is claimed yet. Use one real recipient and one payout throughout the recording; the synthetic CRE and local-chain tests are separate evidence.

## Open the prepared app

From the repository root, run `pnpm dev:all` if the services are not already running. Open [the local reference app](http://127.0.0.1:5173/#/demo). The organization API, relayer and configured payroll service start alongside the web app. This uses existing local configuration; no secret belongs in a screenshot or submission file.

The local reference app includes the local CRE and sending services. The [public app](https://null-protocol.netlify.app/#/demo) uses its hosted organization API and connected-wallet submission unless a public relayer is configured; see [hosted release status](NETLIFY_SUBMISSION.md). Keep the app on Ethereum Sepolia and use test tokens.

## Recipient: publish the actual receiving profile

1. Sign in as the wallet that owns `inbox.nullpay2026.eth`. The last read-only check confirmed ownership and payment-record permission, with the profile still unpublished.
2. Choose Individual and open Inbox. Restore an existing Payment ID backup if you already have one; otherwise save the newly created encrypted backup. A new identity cannot recover entitlements addressed to old keys.
3. Check `inbox.nullpay2026.eth`, review the public-record notice, consent and choose **Link my Payment ID**. Approve the record update in your wallet and wait for the linked state.
4. Save the transaction link. Under **Payment record access**, enter the wallet whose permissions you want to inspect and choose **Check access**. The two-record comparison reads Sepolia and offers **Download permission check**. It makes no changes. A revoked verification editor can be shown using the existing setup evidence; do not grant new access simply to get a screenshot.

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
