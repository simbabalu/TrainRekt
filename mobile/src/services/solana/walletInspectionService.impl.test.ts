import { Keypair, PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import { WalletInspectionServiceError } from '@/types/walletInspection';
import { WalletInspectionRpcService } from './walletInspectionService.impl';

function tokenAccountEntry(options: {
  tokenAccount: PublicKey;
  programOwner?: PublicKey | string;
  mint: string;
  rawAmount: string;
  decimals: number;
  uiAmount: number | null;
  state?: string;
  delegate?: string;
  delegatedAmountRaw?: string;
  closeAuthority?: string;
}) {
  return {
    pubkey: options.tokenAccount,
    account: {
      owner: options.programOwner,
      data: {
        parsed: {
          info: {
            mint: options.mint,
            tokenAmount: {
              amount: options.rawAmount,
              decimals: options.decimals,
              uiAmount: options.uiAmount,
            },
            state: options.state,
            delegate: options.delegate,
            delegatedAmount: options.delegatedAmountRaw ? { amount: options.delegatedAmountRaw } : undefined,
            closeAuthority: options.closeAuthority,
          },
        },
      },
    },
  };
}

describe('WalletInspectionRpcService', () => {
  it('returns empty inspection for wallet with zero token accounts', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce({ value: [] }),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.address).toBe(owner);
    expect(inspection.tokenAccounts).toEqual([]);
    expect(inspection.warnings).toEqual([]);
  });

  it('parses normal SPL initialized account', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mint = Keypair.generate().publicKey.toBase58();
    const tokenAccount = Keypair.generate().publicKey;

    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount,
              mint,
              rawAmount: '1500',
              decimals: 3,
              uiAmount: 1.5,
              state: 'initialized',
            }),
          ],
        })
        .mockResolvedValueOnce({ value: [] }),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(1);
    expect(inspection.tokenAccounts[0]).toMatchObject({
      tokenAccountAddress: tokenAccount.toBase58(),
      mintAddress: mint,
      program: 'spl-token',
      rawAmount: '1500',
      decimals: 3,
      uiAmount: 1.5,
      state: 'initialized',
      delegateAddress: null,
      delegatedAmountRaw: null,
      closeAuthorityAddress: null,
    });
  });

  it('parses empty, delegated, frozen, and Token-2022 accounts', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mintA = Keypair.generate().publicKey.toBase58();
    const mintB = Keypair.generate().publicKey.toBase58();
    const delegate = Keypair.generate().publicKey.toBase58();

    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount: Keypair.generate().publicKey,
              mint: mintA,
              rawAmount: '0',
              decimals: 6,
              uiAmount: 0,
              state: 'frozen',
              delegate,
              delegatedAmountRaw: '1',
            }),
          ],
        })
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount: Keypair.generate().publicKey,
              mint: mintB,
              rawAmount: '9',
              decimals: 0,
              uiAmount: 9,
              state: 'initialized',
            }),
          ],
        }),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(2);

    const delegatedFrozen = inspection.tokenAccounts.find((entry) => entry.delegateAddress === delegate);
    expect(delegatedFrozen).toBeDefined();
    expect(delegatedFrozen?.rawAmount).toBe('0');
    expect(delegatedFrozen?.state).toBe('frozen');
    expect(delegatedFrozen?.delegatedAmountRaw).toBe('1');

    const token2022Account = inspection.tokenAccounts.find((entry) => entry.program === 'token-2022');
    expect(token2022Account).toBeDefined();
  });

  it('maps unsupported token-account state to unknown', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount: Keypair.generate().publicKey,
              mint: Keypair.generate().publicKey.toBase58(),
              rawAmount: '5',
              decimals: 0,
              uiAmount: 5,
              state: 'paused',
            }),
          ],
        })
        .mockResolvedValueOnce({ value: [] }),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts[0].state).toBe('unknown');
  });

  it('maps unexpected owner program to unknown program', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const unknownProgram = Keypair.generate().publicKey;
    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount: Keypair.generate().publicKey,
              programOwner: unknownProgram,
              mint: Keypair.generate().publicKey.toBase58(),
              rawAmount: '1',
              decimals: 0,
              uiAmount: 1,
              state: 'initialized',
            }),
          ],
        })
        .mockResolvedValueOnce({ value: [] }),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts[0].program).toBe('unknown');
  });

  it('skips malformed parsed RPC entries with non-fatal warnings', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const validTokenAccount = Keypair.generate().publicKey;

    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            { pubkey: Keypair.generate().publicKey, account: { data: { parsed: { info: { mint: 'invalid', tokenAmount: { amount: 'x' } } } } } },
            tokenAccountEntry({
              tokenAccount: validTokenAccount,
              mint: Keypair.generate().publicKey.toBase58(),
              rawAmount: '2',
              decimals: 0,
              uiAmount: 2,
              state: 'initialized',
            }),
          ],
        })
        .mockResolvedValueOnce({ value: [] }),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(1);
    expect(inspection.tokenAccounts[0].tokenAccountAddress).toBe(validTokenAccount.toBase58());
    expect(inspection.warnings.length).toBeGreaterThan(0);
  });

  it('merges duplicate accounts returned across both program queries', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const duplicateTokenAccount = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey.toBase58();

    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount: duplicateTokenAccount,
              mint,
              rawAmount: '3',
              decimals: 0,
              uiAmount: 3,
              state: 'initialized',
            }),
          ],
        })
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount: duplicateTokenAccount,
              mint,
              rawAmount: '3',
              decimals: 0,
              uiAmount: 3,
              state: 'initialized',
            }),
          ],
        }),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(1);
    expect(inspection.warnings.some((warning) => warning.includes('Duplicate token account'))).toBe(true);
  });

  it('returns partial inspection when one token-program query fails', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            tokenAccountEntry({
              tokenAccount: Keypair.generate().publicKey,
              mint: Keypair.generate().publicKey.toBase58(),
              rawAmount: '1',
              decimals: 0,
              uiAmount: 1,
              state: 'initialized',
            }),
          ],
        })
        .mockRejectedValueOnce(new Error('Token-2022 owner index unavailable')),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(1);
    expect(inspection.warnings).toContain('Token-2022 account inspection could not be completed.');
  });

  it('fails inspection when both token-program queries fail', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = {
      getParsedTokenAccountsByOwner: vi
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed: timeout'))
        .mockRejectedValueOnce(new Error('fetch failed: timeout')),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });

    await expect(service.getInspection(owner)).rejects.toEqual(
      new WalletInspectionServiceError('rpc-unavailable', 'Wallet inspection is temporarily unavailable. Please try again.'),
    );
  });

  it('maps invalid public wallet address errors', async () => {
    const client = {
      getParsedTokenAccountsByOwner: vi.fn(),
    };

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });

    await expect(service.getInspection('not-an-address')).rejects.toMatchObject({
      name: 'WalletInspectionServiceError',
      reason: 'invalid-address',
    });
  });
});
