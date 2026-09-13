# Sepolia without paid services

The local sandbox needs no environment file, wallet funding, or contract deployment. Actual Sepolia operations need deployed NULL contracts, matching proving artifacts, a public RPC endpoint, and test tokens. The web app and relayer run on your own computer with one private root `.env`; no website hosting or paid service subscription is required.

Use **Sepolia ETH and test USDC only**. This is an unaudited prototype. A claim creates a private note; a separate v0.2 withdrawal transfers its full value to the reviewed public wallet. The archived v0.1 pool cannot withdraw. Deployment does not establish that the complete proof, recovery, or payment flow has been validated.

## Configure and deploy

Install the repository's Node and pnpm versions and dependencies as described in the [README](../README.md), then run from the repository root:

```sh
pnpm setup:sepolia
pnpm deploy:plan
```

`setup:sepolia` creates the single root `.env` from [the canonical example](../.env.example), restricts file access, and prints only the deployer's public address. It reuses existing keys and preserves nonempty settings. Deployment, treasury tools, and local services all read this file. Vite exposes only its `VITE_` variables to the browser. Never give a secret a `VITE_` prefix.

The plan checks the Sepolia chain, test asset, and matching generated artifacts, resolves contract-library links, and estimates the funding needed without sending transactions. Fund the displayed address with the indicated amount of **Sepolia ETH**. If its balance is insufficient, deployment must wait for funding; configuration alone cannot deploy contracts.

When funded, run:

```sh
pnpm deploy:sepolia
pnpm treasury:init
pnpm treasury:register --broadcast
pnpm setup:relayer --fund
pnpm dev:all
```

The deployment command records actual contract addresses and runtime hashes in `deployments/11155111.json`, synchronizes browser artifacts, and sets the Sepolia workspace in root `.env`. Treasury initialization creates a separate private authorization signer; registration publishes only its policy commitment. Relayer setup creates a separate gas wallet and, with `--fund`, transfers enough Sepolia ETH from the deployer to bring it to 0.05 ETH once. Existing registration and funding journals prevent repeating completed setup transactions.

`pnpm dev:all` starts the web app at **http://127.0.0.1:5173** and relayer at **http://127.0.0.1:8787**. `pnpm dev` starts just the web app, and `pnpm relayer` starts just the relay. Restart affected processes after root `.env` changes. Preserve that private file, the deployment record, and private treasury recovery files. See [implementation status](IMPLEMENTATION_STATUS.md) for confirmed setup evidence.

If artifact checks fail, follow the [deployment guide](DEPLOYMENT.md) to regenerate the pinned circuits, genuine verifiers, and Solidity artifacts as a matching set. Never substitute accepting verifiers or bypass checksum checks.

## What the free default uses

| Requirement | Default |
| --- | --- |
| RPC | Reference app: `https://0xrpc.io/sep`, with PublicNode fallback. Deployment/CLI defaults still use [PublicNode](https://ethereum-sepolia-rpc.publicnode.com/). Neither default needs an API key. Every recovered balance is checked against the onchain roots. |
| Asset | Existing Circle test USDC at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, listed in [Circle's official documentation](https://developers.circle.com/gateway/quickstarts/unified-balance-evm) |
| Test USDC funding | [Circle's free faucet](https://faucet.circle.com/); choose Ethereum Sepolia and the wallet that will make the public deposit |
| Wallet | An installed browser wallet through the application's existing injected-wallet connection |
| Discovery | Public event scanning through RPC |
| Compilation and proving | Local browser workers and the project's generated public artifacts |
| App and relay | Your own computer, using `pnpm dev:all` |
| Treasury authorization | The separate local signer and `pnpm treasury:sign` |
| Transaction submission | The local relayer or connected wallet; gas uses Sepolia ETH |

The deployer pays for contract deployment and the explicitly requested policy-registration and relay-funding setup transactions. It does not receive test USDC automatically, approve a token allowance, or deposit funds. A browser wallet making a public deposit needs its own test USDC and Sepolia ETH.

Treasury distributions require the policy created by `pnpm treasury:init` and a signature over the exact reviewed distribution intent. Import `.artifacts/treasury-policy.json` into the browser, then use `pnpm treasury:sign --input <exported-intent.json> --digest <reviewed-digest>` and import the resulting compact signature. Follow [the local treasury guide](../tools/TREASURY.md) for the complete workflow. The signer key stays in root `.env`, and the imported signature becomes part of the private proof witness. Ordinary `personal_sign` is incompatible; deployment and policy registration do not complete a distribution.

## Optional integrations and their limits

Keep Privy, Graph, and CRE settings blank until intentionally configured. The default local path does not require accounts for these services; local relayer setup fills its own endpoint.

| Integration | When it helps | Cost or access boundary |
| --- | --- | --- |
| Privy organization approvals | Login and managed wallet policy/quorum approval | [Privy's Free plan](https://www.privy.io/pricing) lists 0–499 monthly active users and 50,000 monthly signatures. Usage beyond published limits can incur charges. It also requires actual wallet, quorum, policy, and member configuration. |
| The Graph | Indexing public history instead of repeated RPC scans | [The Free plan](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/) includes 100,000 monthly queries; [Studio development endpoints](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/) are limited to 3,000 queries/day. RPC fallback works without it. |
| Local relayer | Broadcasting public proofs from a separate gas wallet | The included service can run on your computer without a subscription; its broadcaster still needs Sepolia ETH. It is optional because wallet submission is supported. |
| Chainlink CRE | Independent confidential compilation inside a TEE | [Workflow deployment requires approval](https://docs.chain.link/cre/guides/operations/deploying-workflows), and [Confidential Workflows are a separate invite-only private beta](https://docs.chain.link/cre/account/confidential-workflows-access). Free confidential execution is not guaranteed by these documents. Keep this unconfigured until access and cost terms are confirmed. |

Privy and relayer launch commands load the same root `.env`. A template does not supply optional credentials or prove a successful payment. See [service configuration](SERVICE_CONFIGURATION.md) before enabling additional integrations.

The separate [local compiler](../services/cre-workflow/README.md) is explicitly marked `local-fallback` with `confidentialExecution: false`; it is not a deployed CRE workflow. Substreams is also optional and is not required for RPC discovery.

These are practical choices for a small testnet demonstration, not a claim of unlimited free service or a universal best provider. The provider limits and access requirements above were checked on 6 September 2026; recheck them before expanding usage or enabling billing.
