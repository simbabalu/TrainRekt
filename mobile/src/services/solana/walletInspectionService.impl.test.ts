import { Keypair, PublicKey } from '@solana/web3.js';
import {
  ACCOUNT_SIZE,
  AccountState,
  AccountType,
  DefaultAccountStateLayout,
  GroupMemberPointerLayout,
  GroupPointerLayout,
  InterestBearingMintConfigStateLayout,
  MetadataPointerLayout,
  MintLayout,
  PermanentDelegateLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TransferFeeConfigLayout,
  TransferHookLayout,
} from '@solana/spl-token';
import { describe, expect, it, vi } from 'vitest';

import { WalletInspectionServiceError } from '@/types/walletInspection';
import { WalletInspectionRpcService } from './walletInspectionService.impl';

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function encodeBorshString(value: string): Uint8Array {
  const text = new TextEncoder().encode(value);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, text.length, true);
  return concatBytes([length, text]);
}

function metadataAccountData(options: { mint: string; name: string; symbol: string }): Uint8Array {
  const key = new Uint8Array([4]);
  const updateAuthority = new Uint8Array(32);
  const mint = new PublicKey(options.mint).toBytes();
  return concatBytes([
    key,
    updateAuthority,
    mint,
    encodeBorshString(options.name),
    encodeBorshString(options.symbol),
  ]);
}

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

function metadataPdaForMint(mintAddress: string): string {
  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('metadata'), METADATA_PROGRAM_ID.toBuffer(), new PublicKey(mintAddress).toBuffer()],
    METADATA_PROGRAM_ID,
  );
  return metadataAccount.toBase58();
}

function encodeExtensionRecord(extensionType: number, extensionData: Uint8Array): Uint8Array {
  const header = new Uint8Array(4);
  const view = new DataView(header.buffer);
  view.setUint16(0, extensionType, true);
  view.setUint16(2, extensionData.length, true);
  return concatBytes([header, extensionData]);
}

function encodeLayoutRecord(
  extensionType: number,
  layout: { span: number; encode: (value: any, buffer: Uint8Array, offset?: number) => number },
  value: any,
): Uint8Array {
  const buffer = new Uint8Array(layout.span);
  layout.encode(value, buffer);
  return encodeExtensionRecord(extensionType, buffer);
}

function createMintAccountInfo(options: {
  mintAddress: string;
  program: 'spl-token' | 'token-2022';
  mintAuthority?: PublicKey | null;
  freezeAuthority?: PublicKey | null;
  decimals?: number;
  supply?: bigint;
  extensionRecords?: Uint8Array[];
}) {
  const mintAuthority = options.mintAuthority ?? null;
  const freezeAuthority = options.freezeAuthority ?? null;
  const decimals = options.decimals ?? 6;
  const supply = options.supply ?? 1_000_000n;
  const zeroPublicKey = new PublicKey(new Uint8Array(32));
  const extensionData = options.extensionRecords ? concatBytes(options.extensionRecords) : new Uint8Array();
  const hasExtensions = options.program === 'token-2022' && extensionData.length > 0;
  const data = new Uint8Array(hasExtensions ? ACCOUNT_SIZE + 1 + extensionData.length : MintLayout.span);

  MintLayout.encode(
    {
      mintAuthorityOption: mintAuthority ? 1 : 0,
      mintAuthority: mintAuthority ?? zeroPublicKey,
      supply,
      decimals,
      isInitialized: true,
      freezeAuthorityOption: freezeAuthority ? 1 : 0,
      freezeAuthority: freezeAuthority ?? zeroPublicKey,
    },
    data,
  );

  if (hasExtensions) {
    data[ACCOUNT_SIZE] = AccountType.Mint;
    data.set(extensionData, ACCOUNT_SIZE + 1);
  }

  return {
    data,
    owner: options.program === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
    executable: false,
    lamports: 1,
    rentEpoch: 0,
  };
}

function createMintLookupImplementation(options: {
  mintsByAddress: Record<string, ReturnType<typeof createMintAccountInfo>>;
  metadataByMint?: Record<string, Uint8Array>;
}) {
  const metadataByAddress = new Map<string, Uint8Array>(
    Object.entries(options.metadataByMint ?? {}).map(([mintAddress, metadata]) => [metadataPdaForMint(mintAddress), metadata]),
  );

  return (publicKeys: PublicKey[]) => Promise.resolve(publicKeys.map((publicKey) => {
    const address = publicKey.toBase58();
    if (options.mintsByAddress[address]) return options.mintsByAddress[address];
    const metadata = metadataByAddress.get(address);
    if (!metadata) return null;
    return {
      data: metadata,
      owner: METADATA_PROGRAM_ID,
      executable: false,
      lamports: 1,
      rentEpoch: 0,
    };
  }));
}

function createClient() {
  return {
    getParsedTokenAccountsByOwner: vi.fn(),
    getMultipleAccountsInfo: vi.fn().mockImplementation((publicKeys: PublicKey[]) => Promise.resolve(publicKeys.map(() => null))),
  };
}

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
    const client = createClient();
    client.getParsedTokenAccountsByOwner
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce({ value: [] });

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

    const client = createClient();
    client.getParsedTokenAccountsByOwner
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
        .mockResolvedValueOnce({ value: [] });

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

    const client = createClient();
    client.getParsedTokenAccountsByOwner
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
        });

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
    const client = createClient();
    client.getParsedTokenAccountsByOwner
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
        .mockResolvedValueOnce({ value: [] });

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts[0].state).toBe('unknown');
  });

  it('maps unexpected owner program to unknown program', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const unknownProgram = Keypair.generate().publicKey;
    const client = createClient();
    client.getParsedTokenAccountsByOwner
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
        .mockResolvedValueOnce({ value: [] });

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts[0].program).toBe('unknown');
  });

  it('skips malformed parsed RPC entries with non-fatal warnings', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const validTokenAccount = Keypair.generate().publicKey;

    const client = createClient();
    client.getParsedTokenAccountsByOwner
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
        .mockResolvedValueOnce({ value: [] });

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

    const client = createClient();
    client.getParsedTokenAccountsByOwner
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
        });

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(1);
    expect(inspection.warnings.some((warning) => warning.includes('Duplicate token account'))).toBe(true);
  });

  it('returns partial inspection when one token-program query fails', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = createClient();
    client.getParsedTokenAccountsByOwner
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
        .mockRejectedValueOnce(new Error('Token-2022 owner index unavailable'));

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(1);
    expect(inspection.warnings).toContain('Token-2022 account inspection could not be completed.');
  });

  it('fails inspection when both token-program queries fail', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const client = createClient();
    client.getParsedTokenAccountsByOwner
      .mockRejectedValueOnce(new Error('fetch failed: timeout'))
      .mockRejectedValueOnce(new Error('fetch failed: timeout'));

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });

    await expect(service.getInspection(owner)).rejects.toEqual(
      new WalletInspectionServiceError('rpc-unavailable', 'Wallet inspection is temporarily unavailable. Please try again.'),
    );
  });

  it('maps invalid public wallet address errors', async () => {
    const client = createClient();

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });

    await expect(service.getInspection('not-an-address')).rejects.toMatchObject({
      name: 'WalletInspectionServiceError',
      reason: 'invalid-address',
    });
  });

  it('enriches token account rows with metadata name and symbol by mint', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mint = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({
            tokenAccount: Keypair.generate().publicKey,
            mint,
            rawAmount: '8',
            decimals: 6,
            uiAmount: 8,
            state: 'initialized',
          }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [mint]: createMintAccountInfo({ mintAddress: mint, program: 'spl-token' }),
        },
        metadataByMint: {
          [mint]: metadataAccountData({ mint, name: 'USD Coin', symbol: 'USDC' }),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts[0].tokenDisplayMetadata).toEqual({
      mint,
      name: 'USD Coin',
      symbol: 'USDC',
    });
  });

  it('uses metadata fallback when metadata payload is malformed', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mint = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({
            tokenAccount: Keypair.generate().publicKey,
            mint,
            rawAmount: '1',
            decimals: 0,
            uiAmount: 1,
            state: 'initialized',
          }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [mint]: createMintAccountInfo({ mintAddress: mint, program: 'spl-token' }),
        },
        metadataByMint: {
          [mint]: new Uint8Array([1, 2, 3]),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts[0].tokenDisplayMetadata).toBeNull();
  });

  it('fails open when metadata lookup fails and still returns inspection signals', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mint = Keypair.generate().publicKey.toBase58();
    const delegate = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({
            tokenAccount: Keypair.generate().publicKey,
            mint,
            rawAmount: '0',
            decimals: 6,
            uiAmount: 0,
            state: 'frozen',
            delegate,
          }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo
      .mockImplementationOnce(
        createMintLookupImplementation({
          mintsByAddress: {
            [mint]: createMintAccountInfo({ mintAddress: mint, program: 'spl-token' }),
          },
        }),
      )
      .mockRejectedValueOnce(new Error('metadata RPC failed'));

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(1);
    expect(inspection.tokenAccounts[0].state).toBe('frozen');
    expect(inspection.tokenAccounts[0].delegateAddress).toBe(delegate);
    expect(inspection.tokenAccounts[0].tokenDisplayMetadata).toBeNull();
    expect(inspection.warnings).toContain('Token metadata lookup failed; showing canonical mint identifiers only.');
  });

  it('deduplicates metadata lookup work by mint and caches between refresh calls', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mintA = Keypair.generate().publicKey.toBase58();
    const mintB = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: mintA, rawAmount: '2', decimals: 6, uiAmount: 2 }),
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: mintA, rawAmount: '3', decimals: 6, uiAmount: 3 }),
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: mintB, rawAmount: '4', decimals: 6, uiAmount: 4 }),
        ],
      })
      .mockResolvedValueOnce({ value: [] })
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: mintA, rawAmount: '5', decimals: 6, uiAmount: 5 }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [mintA]: createMintAccountInfo({ mintAddress: mintA, program: 'spl-token' }),
          [mintB]: createMintAccountInfo({ mintAddress: mintB, program: 'spl-token' }),
        },
        metadataByMint: {
          [mintA]: metadataAccountData({ mint: mintA, name: 'Token A', symbol: 'TKA' }),
          [mintB]: metadataAccountData({ mint: mintB, name: 'Token B', symbol: 'TKB' }),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const firstInspection = await service.getInspection(owner);
    const secondInspection = await service.getInspection(owner);

    expect(firstInspection.tokenAccounts).toHaveLength(3);
    expect(secondInspection.tokenAccounts).toHaveLength(1);
    const metadataCalls = client.getMultipleAccountsInfo.mock.calls.filter(([publicKeys]) => (
      publicKeys.some((publicKey: PublicKey) => publicKey.toBase58() === metadataPdaForMint(mintA) || publicKey.toBase58() === metadataPdaForMint(mintB))
    ));
    expect(metadataCalls).toHaveLength(1);
  });

  it('resolves metadata for Token-2022 accounts through mint metadata PDA lookup', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mint = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({ value: [] })
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({
            tokenAccount: Keypair.generate().publicKey,
            mint,
            rawAmount: '7',
            decimals: 0,
            uiAmount: 7,
            state: 'initialized',
          }),
        ],
      });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [mint]: createMintAccountInfo({ mintAddress: mint, program: 'token-2022' }),
        },
        metadataByMint: {
          [mint]: metadataAccountData({ mint, name: 'Token Twenty Two', symbol: 'TT22' }),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts[0].program).toBe('token-2022');
    expect(inspection.tokenAccounts[0].tokenDisplayMetadata?.symbol).toBe('TT22');
  });

  it('decodes mint authority and freeze authority states for classic SPL mints', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mintWithAuthorities = Keypair.generate().publicKey.toBase58();
    const mintRevoked = Keypair.generate().publicKey.toBase58();
    const mintAuthority = Keypair.generate().publicKey;
    const freezeAuthority = Keypair.generate().publicKey;
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: mintWithAuthorities, rawAmount: '1', decimals: 0, uiAmount: 1 }),
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: mintRevoked, rawAmount: '2', decimals: 0, uiAmount: 2 }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [mintWithAuthorities]: createMintAccountInfo({
            mintAddress: mintWithAuthorities,
            program: 'spl-token',
            mintAuthority,
            freezeAuthority,
          }),
          [mintRevoked]: createMintAccountInfo({
            mintAddress: mintRevoked,
            program: 'spl-token',
            mintAuthority: null,
            freezeAuthority: null,
          }),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    const byMint = new Map(inspection.mintInspections.map((mintInspection) => [mintInspection.mintAddress, mintInspection]));
    expect(byMint.get(mintWithAuthorities)?.mintAuthorityState).toBe('active');
    expect(byMint.get(mintWithAuthorities)?.freezeAuthorityState).toBe('active');
    expect(byMint.get(mintRevoked)?.mintAuthorityState).toBe('revoked');
    expect(byMint.get(mintRevoked)?.freezeAuthorityState).toBe('revoked');
  });

  it('decodes supported Token-2022 extensions into mint inspection facts', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mint = Keypair.generate().publicKey.toBase58();
    const authorityA = Keypair.generate().publicKey;
    const authorityB = Keypair.generate().publicKey;
    const hookProgram = Keypair.generate().publicKey;
    const metadataAddress = Keypair.generate().publicKey;
    const groupAddress = Keypair.generate().publicKey;
    const memberAddress = Keypair.generate().publicKey;
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({ value: [] })
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint, rawAmount: '9', decimals: 0, uiAmount: 9 }),
        ],
      });

    const transferFeeBuffer = new Uint8Array(TransferFeeConfigLayout.span);
    TransferFeeConfigLayout.encode({
      transferFeeConfigAuthority: authorityA,
      withdrawWithheldAuthority: authorityB,
      withheldAmount: 0n,
      olderTransferFee: { epoch: 1n, maximumFee: 100n, transferFeeBasisPoints: 25 },
      newerTransferFee: { epoch: 2n, maximumFee: 200n, transferFeeBasisPoints: 50 },
    }, transferFeeBuffer);

    const token2022Mint = createMintAccountInfo({
      mintAddress: mint,
      program: 'token-2022',
      extensionRecords: [
        encodeLayoutRecord(12, PermanentDelegateLayout, { delegate: authorityA }),
        encodeExtensionRecord(9, new Uint8Array()),
        encodeLayoutRecord(6, DefaultAccountStateLayout, { state: AccountState.Frozen }),
        encodeLayoutRecord(10, InterestBearingMintConfigStateLayout, {
          rateAuthority: authorityA,
          initializationTimestamp: 1,
          preUpdateAverageRate: 1,
          lastUpdateTimestamp: 2,
          currentRate: 2,
        }),
        encodeLayoutRecord(14, TransferHookLayout, { authority: authorityA, programId: hookProgram }),
        encodeExtensionRecord(1, transferFeeBuffer),
        encodeLayoutRecord(18, MetadataPointerLayout, { authority: authorityA, metadataAddress }),
        encodeLayoutRecord(20, GroupPointerLayout, { authority: authorityA, groupAddress }),
        encodeLayoutRecord(22, GroupMemberPointerLayout, { authority: authorityA, memberAddress }),
      ],
    });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [mint]: token2022Mint,
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.mintInspections).toHaveLength(1);
    const mintInspection = inspection.mintInspections[0];
    expect(mintInspection.program).toBe('token-2022');
    expect(mintInspection.token2022Extensions).toEqual(expect.arrayContaining([
      'permanent-delegate',
      'transfer-fee-config',
      'transfer-hook',
      'non-transferable',
      'default-account-state',
      'interest-bearing-config',
      'metadata-pointer',
      'group-pointer',
      'group-member-pointer',
    ]));
    expect(mintInspection.defaultAccountState).toBe('frozen');
  });

  it('deduplicates shared mint lookups across multiple token accounts', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const mint = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint, rawAmount: '1', decimals: 0, uiAmount: 1 }),
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint, rawAmount: '2', decimals: 0, uiAmount: 2 }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [mint]: createMintAccountInfo({ mintAddress: mint, program: 'spl-token' }),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.mintInspections).toHaveLength(1);
    const mintLookupCall = client.getMultipleAccountsInfo.mock.calls[0][0] as PublicKey[];
    expect(mintLookupCall).toHaveLength(1);
  });

  it('continues inspection when one mint account is malformed or unreadable', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const malformedMint = Keypair.generate().publicKey.toBase58();
    const validMint = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: malformedMint, rawAmount: '1', decimals: 0, uiAmount: 1 }),
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: validMint, rawAmount: '2', decimals: 0, uiAmount: 2 }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [malformedMint]: {
            data: new Uint8Array([1, 2, 3]),
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
          [validMint]: createMintAccountInfo({ mintAddress: validMint, program: 'spl-token' }),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.tokenAccounts).toHaveLength(2);
    const malformedInspection = inspection.mintInspections.find((entry) => entry.mintAddress === malformedMint);
    expect(malformedInspection?.unavailableReason).toBe('Mint decode failed.');
    expect(inspection.warnings.some((warning) => warning.includes('could not be decoded'))).toBe(true);
  });

  it('keeps other mint results when one mint account is missing from RPC', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const missingMint = Keypair.generate().publicKey.toBase58();
    const presentMint = Keypair.generate().publicKey.toBase58();
    const client = createClient();

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({
        value: [
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: missingMint, rawAmount: '1', decimals: 0, uiAmount: 1 }),
          tokenAccountEntry({ tokenAccount: Keypair.generate().publicKey, mint: presentMint, rawAmount: '1', decimals: 0, uiAmount: 1 }),
        ],
      })
      .mockResolvedValueOnce({ value: [] });

    client.getMultipleAccountsInfo.mockImplementation(
      createMintLookupImplementation({
        mintsByAddress: {
          [presentMint]: createMintAccountInfo({ mintAddress: presentMint, program: 'spl-token' }),
        },
      }),
    );

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    const inspection = await service.getInspection(owner);

    expect(inspection.mintInspections).toHaveLength(2);
    expect(inspection.mintInspections.find((entry) => entry.mintAddress === missingMint)?.unavailableReason).toBe('Mint account was not found.');
    expect(inspection.mintInspections.find((entry) => entry.mintAddress === presentMint)?.unavailableReason).toBeNull();
  });

  it('never introduces signing or transaction calls in inspection flow', async () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const signTransaction = vi.fn();
    const sendTransaction = vi.fn();
    const client = {
      ...createClient(),
      signTransaction,
      sendTransaction,
    };

    client.getParsedTokenAccountsByOwner
      .mockResolvedValueOnce({ value: [] })
      .mockResolvedValueOnce({ value: [] });

    const service = new WalletInspectionRpcService({ network: 'mainnet-beta', endpoint: 'https://rpc.test', client });
    await service.getInspection(owner);

    expect(signTransaction).not.toHaveBeenCalled();
    expect(sendTransaction).not.toHaveBeenCalled();
  });
});
