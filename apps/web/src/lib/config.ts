export const config = {
  chainId: 11155111n,
  defaultEnvironment: 'testnet' as const,
  privyAppId: import.meta.env.VITE_PRIVY_APP_ID as string | undefined,
  rpcUrl: (import.meta.env.VITE_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com') as string,
  graphUrl: import.meta.env.VITE_GRAPH_URL as string | undefined,
  relayerUrl: import.meta.env.VITE_RELAYER_URL as string | undefined,
  poolAddress: import.meta.env.VITE_POOL_ADDRESS as `0x${string}` | undefined,
  deploymentBlock: BigInt(import.meta.env.VITE_DEPLOYMENT_BLOCK || '0'),
  confirmations: Math.max(1, Number(import.meta.env.VITE_CONFIRMATIONS || '3')),
};

// A local namespace for cryptographic sandbox artifacts; this is not a deployment.
export const sandboxContext = { chainId: 11155111n, poolAddress: '0x0000000000000000000000000000000000000001' as const };
export const protocolContext = config.poolAddress ? { chainId: config.chainId, poolAddress: config.poolAddress } : null;
