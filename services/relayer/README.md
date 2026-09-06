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

Configure the environment from `.env.example` before starting `pnpm relayer` from the workspace. The process does not automatically read `.env`; export variables in the shell or use a secrets-managed process runner. It binds loopback for deployment behind an HTTPS reverse proxy. `NULL_MANIFEST_PATH` resolves from the relayer process working directory. The service stays unavailable unless a deployed manifest, RPC and funded broadcasting key are configured. The broadcaster key is a gas wallet, never a recipient key.

Every send checks chain ID, pool runtime code hash, immutable verifier addresses and runtime hashes, asset address, accepted root, deadline and spent nullifiers. It executes `eth_call` against the actual pool with exact calldata before estimating bounded gas and submitting. The contract still performs the authoritative proof/root checks atomically. A 202 response means submitted, not mined or confirmed; clients must track the transaction receipt and finality. Send errors after submission can be uncertain: check public nullifier/receipt state before retrying.

Rate limits are 12 requests/minute per direct socket address, with a bounded global queue. Requests from a proxy require an additional trusted edge limiter; the service deliberately does not trust client-supplied `X-Forwarded-For`. CORS origins are an explicit list. There is no recipient login. No request or proof body is logged or persisted. A bounded in-memory map holds only public transaction results for identical calldata.

To export exact self-broadcast calldata without a hosted relayer:

```sh
pnpm --filter @null-protocol/relayer broadcast --proof claim.json
```

To send locally, configure the same manifest/RPC and `BROADCAST_PRIVATE_KEY` then add `--send`. The CLI still validates deployment, simulates and uses the exact proof-bound outputs. It never signs with the hidden stealth key. Its existence does not hide the broadcasting wallet or network metadata.

No live relay transaction has been submitted by this development work.
