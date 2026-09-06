# Public-only relay

The relayer accepts `POST /api/relay` with exactly:

```json
{
  "chainId": 11155111,
  "pool": "DEPLOYED_POOL_ADDRESS",
  "method": "claim",
  "proof": "0x...",
  "publicInputs": ["0x... eight 32-byte field values ..."]
}
```

`createDistribution` instead requires 15 inputs and exactly eight `{ephemeralPubKey,viewTag,ciphertext}` envelopes. Transport tag/slot/version live in the proof-bound public context and array order, so the relayer envelope objects deliberately exclude them. Extra properties are rejected at every request layer, including keys, amounts, salaries, signatures, employee references and arbitrary calldata. Shielding uses the payer's wallet because the public ERC-20 deposit is its explicit entry boundary.

All configuration lives in the single private root `.env`; use [the root template](../../.env.example). The `dev` and `broadcast` scripts use Node's built-in environment-file support (Node 22.16 or later) to load it, with existing shell variables taking precedence. `NULL_MANIFEST_PATH=deployments/11155111.json` resolves from the repository root and selects the manifest written by deployment.

After contract deployment, run `pnpm setup:relayer` to create or reuse a separate gas wallet and show its funding plan. Add `--fund` to transfer enough Sepolia ETH from the deployer to bring the relay wallet to 0.05 ETH once; the funding journal preserves the transaction across retries. Setup writes the relay key, RPC, and browser endpoint into root `.env` without printing secrets. The broadcaster is a gas wallet, never a recipient or treasury signer key.

Run `pnpm relayer` for this service alone, or `pnpm dev:all` for the local web app and relay together. The service binds `127.0.0.1:8787`; no remote hosting is configured or required. Both local frontend origins are accepted by the example. The service stays unavailable unless its deployed manifest, RPC, and funded key are valid. Use Sepolia test ETH only.

Every send checks chain ID, pool runtime code hash, immutable verifier addresses and runtime hashes, asset address, accepted root, deadline and spent nullifiers. It executes `eth_call` against the actual pool with exact calldata before estimating bounded gas and submitting. The contract still performs the authoritative proof/root checks atomically. A 202 response means submitted, not mined or confirmed; clients must track the transaction receipt and finality. Send errors after submission can be uncertain: check public nullifier/receipt state before retrying.

Rate limits are 12 requests/minute per direct socket address, with a bounded global queue. Requests from a proxy require an additional trusted edge limiter; the service deliberately does not trust client-supplied `X-Forwarded-For`. CORS origins are an explicit list. There is no recipient login. No request or proof body is logged or persisted. A bounded in-memory map holds only public transaction results for identical calldata.

To export exact self-broadcast calldata:

```sh
pnpm --filter @null-protocol/relayer broadcast --proof claim.json
```

To send locally, configure the same manifest/RPC and `BROADCAST_PRIVATE_KEY` then add `--send`. The CLI still validates deployment, simulates and uses the exact proof-bound outputs. It never signs with the hidden stealth key. Its existence does not hide the broadcasting wallet or network metadata.

No live relay transaction has been submitted by this development work.
