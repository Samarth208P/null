/** Estimate and execute contract creation with hypothetical RPC state overrides.
 * No transaction is signed or submitted. Earlier deployments supply runtime code
 * only: NULL constructors read their immutable bindings, not mutable storage.
 */
export async function preflightDeployments({ publicClient, account, steps, atBlock }) {
  const blockNumber = atBlock ?? await publicClient.getBlockNumber();
  const deployed = [];
  const seen = new Set([account.toLowerCase()]);
  for (const step of steps) {
    if (!Number.isSafeInteger(step.nonce) || step.nonce < 0 || seen.has(step.address.toLowerCase()))
      throw new Error(`Invalid constructor preflight address or nonce: ${step.id}.`);
    seen.add(step.address.toLowerCase());
    const stateOverride = [
      // Funding is hypothetical and exists only during this RPC simulation.
      { address: account, balance: 10n ** 24n, nonce: step.nonce },
      ...deployed,
      // Resume can revisit mined deployments. Clear the hypothetical creation
      // address so code/nonce already on chain cannot cause a CREATE collision.
      { address: step.address, balance: 0n, nonce: 0, code: '0x', state: [] },
    ];
    const request = { account, data: step.data, nonce: step.nonce, blockNumber, stateOverride };
    let gasEstimate;
    let runtime;
    try {
      gasEstimate = await publicClient.estimateGas(request);
      runtime = (await publicClient.call(request)).data;
    } catch (error) {
      const detail = String(error?.details ?? error?.shortMessage ?? error?.name ?? 'RPC request failed')
        .replace(/https?:\/\/\S+/g, '[RPC URL]').slice(0, 240);
      throw new Error(`Constructor preflight failed for ${step.id}: ${detail} ` +
        'No transaction was submitted. Resolve the constructor failure or use an RPC supporting eth_call and eth_estimateGas state overrides.');
    }
    if (gasEstimate <= 0n || !/^0x(?:[0-9a-fA-F]{2})+$/.test(runtime ?? ''))
      throw new Error(`Constructor preflight returned no usable gas estimate or runtime for ${step.id}. No transaction was submitted.`);
    if ((runtime.length - 2) / 2 > 24_576)
      throw new Error(`Constructor preflight runtime exceeds EIP-170 for ${step.id}. No transaction was submitted.`);
    step.gasAllowance = (gasEstimate * 120n + 99n) / 100n;
    step.expectedRuntime = runtime;
    deployed.push({ address: step.address, code: runtime, balance: 0n, nonce: 1, state: [] });
  }
  return { blockNumber, gasAllowance: steps.reduce((total, step) => total + step.gasAllowance, 0n) };
}
