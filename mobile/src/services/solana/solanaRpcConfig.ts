import { clusterApiUrl } from '@solana/web3.js';

import type { SolanaNetwork } from '@/types/walletSnapshot';

const DEFAULT_SOLANA_NETWORK: SolanaNetwork = 'mainnet-beta';

export interface SolanaRpcConfig {
  network: SolanaNetwork;
  endpoint: string;
}

function normalizeNetwork(value: string | undefined): SolanaNetwork {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'devnet') return 'devnet';
  if (normalized === 'testnet') return 'testnet';
  if (normalized === 'mainnet' || normalized === 'mainnet-beta') return 'mainnet-beta';
  return DEFAULT_SOLANA_NETWORK;
}

export function getSolanaRpcConfig(env: Record<string, string | undefined> = process.env): SolanaRpcConfig {
  const network = normalizeNetwork(env.EXPO_PUBLIC_SOLANA_NETWORK);
  const endpoint = env.EXPO_PUBLIC_SOLANA_RPC_URL?.trim() || clusterApiUrl(network);
  return { network, endpoint };
}
