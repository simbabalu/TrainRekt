import { Keypair, PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import { WalletSnapshotServiceError } from '@/types/walletSnapshot';
import { WalletSnapshotRpcService } from './walletSnapshotService.impl';

function tokenAccount(pubkey: PublicKey, rawAmount: string) {
  return {
    pubkey,
    account: {
      data: {
        parsed: {
          info: {
            tokenAmount: {
              amount: rawAmount,
            },
          },
        },
      },
    },
  };
}

describe('WalletSnapshotRpcService', () => {
  it('maps SOL balance and token counts across legacy and Token-2022 programs', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getBalance: vi.fn().mockResolvedValue(1_284_000_000),
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccount(Keypair.generate().publicKey, '0'),
            tokenAccount(Keypair.generate().publicKey, '1'),
            tokenAccount(Keypair.generate().publicKey, '8'),
          ],
        })
        .mockResolvedValueOnce({
          value: [
            tokenAccount(Keypair.generate().publicKey, '0'),
          ],
        }),
    };

    const service = new WalletSnapshotRpcService({
      network: 'mainnet-beta',
      endpoint: 'https://rpc.test',
      client,
    });

    const snapshot = await service.getSnapshot(owner);

    expect(snapshot.address).toBe(owner);
    expect(snapshot.network).toBe('mainnet-beta');
    expect(snapshot.solBalanceLamports).toBe(1_284_000_000n);
    expect(snapshot.tokenAccountCount).toBe(4);
    expect(snapshot.nonZeroTokenAccountCount).toBe(2);
    expect(snapshot.zeroBalanceTokenAccountCount).toBe(2);
    expect(new Date(snapshot.fetchedAt).toString()).not.toBe('Invalid Date');
  });

  it('deduplicates accounts that appear in both token program queries', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const duplicatePubkey = Keypair.generate().publicKey;

    const client = {
      getBalance: vi.fn().mockResolvedValue(0),
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccount(duplicatePubkey, '7'),
          ],
        })
        .mockResolvedValueOnce({
          value: [
            tokenAccount(duplicatePubkey, '7'),
          ],
        }),
    };

    const service = new WalletSnapshotRpcService({
      network: 'mainnet-beta',
      endpoint: 'https://rpc.test',
      client,
    });

    const snapshot = await service.getSnapshot(owner);

    expect(snapshot.tokenAccountCount).toBe(1);
    expect(snapshot.nonZeroTokenAccountCount).toBe(1);
    expect(snapshot.zeroBalanceTokenAccountCount).toBe(0);
  });

  it('maps malformed token amount response to invalid-response', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getBalance: vi.fn().mockResolvedValue(0),
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccount(Keypair.generate().publicKey, 'abc'),
          ],
        })
        .mockResolvedValueOnce({ value: [] }),
    };

    const service = new WalletSnapshotRpcService({
      network: 'mainnet-beta',
      endpoint: 'https://rpc.test',
      client,
    });

    await expect(service.getSnapshot(owner)).rejects.toMatchObject({
      name: 'WalletSnapshotServiceError',
      reason: 'invalid-response',
    });
  });

  it('maps invalid public wallet address errors', async () => {
    const client = {
      getBalance: vi.fn(),
      getParsedTokenAccountsByOwner: vi.fn(),
    };

    const service = new WalletSnapshotRpcService({
      network: 'mainnet-beta',
      endpoint: 'https://rpc.test',
      client,
    });

    await expect(service.getSnapshot('not-an-address')).rejects.toMatchObject({
      name: 'WalletSnapshotServiceError',
      reason: 'invalid-address',
    });
  });

  it('maps RPC transport failures to rpc-unavailable', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getBalance: vi.fn().mockRejectedValue(new Error('fetch failed: timeout')),
      getParsedTokenAccountsByOwner: vi.fn(),
    };

    const service = new WalletSnapshotRpcService({
      network: 'mainnet-beta',
      endpoint: 'https://rpc.test',
      client,
    });

    await expect(service.getSnapshot(owner)).rejects.toEqual(
      new WalletSnapshotServiceError('rpc-unavailable', 'Wallet snapshot is temporarily unavailable. Please try again.'),
    );
  });

  it('fails snapshot when token-account owner lookup fails', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getBalance: vi.fn().mockResolvedValue(500_000_000),
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({ value: [] })
        .mockRejectedValueOnce(new Error('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb excluded from account secondary indexes')),
    };

    const service = new WalletSnapshotRpcService({
      network: 'mainnet-beta',
      endpoint: 'https://rpc.test',
      client,
    });

    await expect(service.getSnapshot(owner)).rejects.toEqual(
      new WalletSnapshotServiceError('failed', 'Wallet snapshot failed. Please try again.'),
    );
  });

  it('passes canonical base58 public key to read-only RPC methods', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getBalance: vi.fn().mockResolvedValue(0),
      getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
    };

    const service = new WalletSnapshotRpcService({
      network: 'mainnet-beta',
      endpoint: 'https://rpc.test',
      client,
    });

    await service.getSnapshot(`  ${owner}  `);

    const getBalanceCall = vi.mocked(client.getBalance).mock.calls[0][0] as PublicKey;
    expect(getBalanceCall.toBase58()).toBe(owner);

    const legacyCall = vi.mocked(client.getParsedTokenAccountsByOwner).mock.calls[0][0] as PublicKey;
    const token2022Call = vi.mocked(client.getParsedTokenAccountsByOwner).mock.calls[1][0] as PublicKey;
    expect(legacyCall.toBase58()).toBe(owner);
    expect(token2022Call.toBase58()).toBe(owner);
  });
});
