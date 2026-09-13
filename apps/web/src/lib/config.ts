const configuredRelayerUrl = import.meta.env.VITE_RELAYER_URL as string | undefined;
// A production visitor cannot reach the development machine's relayer.
const localRelayer = configuredRelayerUrl && /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::|\/|$)/i.test(configuredRelayerUrl);
const rpcUrl = (import.meta.env.VITE_RPC_URL || 'https://0xrpc.io/sep') as string;
const rpcFallbacks = (import.meta.env.VITE_RPC_FALLBACK_URLS ?? 'https://ethereum-sepolia-rpc.publicnode.com') as string;

export const config = {
  chainId: 11155111n,
  defaultEnvironment: 'testnet' as const,
  privyAppId: import.meta.env.VITE_PRIVY_APP_ID as string | undefined,
  rpcUrl,
  rpcUrls: [...new Set([rpcUrl, ...rpcFallbacks.split(',').map(url => url.trim()).filter(Boolean)])],
  graphUrl: import.meta.env.VITE_GRAPH_URL as string | undefined,
  relayerUrl: import.meta.env.PROD && localRelayer ? undefined : configuredRelayerUrl,
  poolAddress: import.meta.env.VITE_POOL_ADDRESS as `0x${string}` | undefined,
  confirmations: Math.max(1, Number(import.meta.env.VITE_CONFIRMATIONS || '3')),
};

// A local namespace for cryptographic sandbox artifacts; this is not a deployment.
export const sandboxContext = { chainId: 11155111n, poolAddress: '0x0000000000000000000000000000000000000001' as const };
export const protocolContext = config.poolAddress ? { chainId: config.chainId, poolAddress: config.poolAddress } : null;
