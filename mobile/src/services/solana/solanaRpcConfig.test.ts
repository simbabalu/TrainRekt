import { describe, expect, it } from 'vitest';

import { getSolanaRpcConfig } from './solanaRpcConfig';

describe('getSolanaRpcConfig', () => {
  it('uses explicit public RPC URL when provided', () => {
    const config = getSolanaRpcConfig({
      EXPO_PUBLIC_SOLANA_NETWORK: 'mainnet-beta',
      EXPO_PUBLIC_SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
    });

    expect(config.network).toBe('mainnet-beta');
    expect(config.endpoint).toBe('https://api.mainnet-beta.solana.com');
  });

  it('normalizes network aliases and falls back to clusterApiUrl', () => {
    const config = getSolanaRpcConfig({
      EXPO_PUBLIC_SOLANA_NETWORK: 'mainnet',
      EXPO_PUBLIC_SOLANA_RPC_URL: undefined,
    });

    expect(config.network).toBe('mainnet-beta');
    expect(config.endpoint).toContain('mainnet-beta.solana.com');
  });

  it('supports devnet configuration', () => {
    const config = getSolanaRpcConfig({
      EXPO_PUBLIC_SOLANA_NETWORK: 'devnet',
      EXPO_PUBLIC_SOLANA_RPC_URL: undefined,
    });

    expect(config.network).toBe('devnet');
    expect(config.endpoint).toContain('devnet.solana.com');
  });
});
