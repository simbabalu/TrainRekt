import { Connection, PublicKey } from '@solana/web3.js';

import type { SolanaNetwork, WalletSnapshot } from '@/types/walletSnapshot';
import { WalletSnapshotServiceError } from '@/types/walletSnapshot';
import { getSolanaRpcConfig } from './solanaRpcConfig';
import type { WalletSnapshotService } from './walletSnapshotService';

const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

function isDevRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function sanitizeEndpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    const withoutScheme = endpoint.replace(/^https?:\/\//i, '');
    return withoutScheme.split('/')[0] || 'unknown-host';
  }
}

function stringifySafe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return 'n/a';
  return 'n/a';
}

function logStage(stage: string, details: Record<string, unknown> = {}) {
  if (!isDevRuntime()) return;

  const detailsString = Object.entries(details)
    .map(([key, value]) => `${key}=${stringifySafe(value)}`)
    .join(' ');
  const suffix = detailsString ? ` ${detailsString}` : '';
  console.log(`[WALLET_SNAPSHOT] stage=${stage}${suffix}`);
}

function logFailure(stage: string, error: unknown) {
  if (!isDevRuntime()) return;

  const errorRecord = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  logStage(`${stage} failed`, {
    errorName: errorRecord?.name,
    errorMessage: errorRecord?.message,
    errorCode: errorRecord?.code,
    httpStatus: errorRecord?.status ?? errorRecord?.statusCode ?? errorRecord?.response?.status,
  });
}

interface ParsedTokenAccountEntry {
  pubkey: PublicKey;
  account: {
    data: {
      parsed?: {
        info?: {
          tokenAmount?: {
            amount?: string;
          };
        };
      };
    };
  };
}

interface ParsedTokenAccountResponse {
  value: ParsedTokenAccountEntry[];
}

interface SolanaReadClient {
  getBalance: (owner: PublicKey) => Promise<number>;
  getParsedTokenAccountsByOwner: (owner: PublicKey, filter: { programId: PublicKey }) => Promise<ParsedTokenAccountResponse>;
}

function toLamports(value: number): bigint {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new WalletSnapshotServiceError('invalid-response', 'Wallet snapshot RPC returned an invalid SOL balance.');
  }
  return BigInt(value);
}

function parseTokenAmount(entry: ParsedTokenAccountEntry): bigint {
  const amount = entry.account.data.parsed?.info?.tokenAmount?.amount;
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new WalletSnapshotServiceError('invalid-response', 'Wallet snapshot RPC returned malformed token account data.');
  }
  return BigInt(amount);
}

function mapServiceError(error: unknown): WalletSnapshotServiceError {
  if (error instanceof WalletSnapshotServiceError) return error;
  if (error instanceof Error && /(fetch|network|timeout|429|503|unavailable|rate limit|failed to get)/i.test(error.message)) {
    return new WalletSnapshotServiceError('rpc-unavailable', 'Wallet snapshot is temporarily unavailable. Please try again.');
  }
  return new WalletSnapshotServiceError('failed', 'Wallet snapshot failed. Please try again.');
}

function mergeTokenAccounts(...responses: ParsedTokenAccountResponse[]): Map<string, bigint> {
  const amountsByAccount = new Map<string, bigint>();

  for (const response of responses) {
    if (!response || !Array.isArray(response.value)) {
      throw new WalletSnapshotServiceError('invalid-response', 'Wallet snapshot RPC returned malformed token account results.');
    }

    for (const tokenAccount of response.value) {
      if (!tokenAccount?.pubkey || !(tokenAccount.pubkey instanceof PublicKey)) {
        throw new WalletSnapshotServiceError('invalid-response', 'Wallet snapshot RPC returned malformed token account keys.');
      }

      const key = tokenAccount.pubkey.toBase58();
      const amount = parseTokenAmount(tokenAccount);

      if (!amountsByAccount.has(key)) {
        amountsByAccount.set(key, amount);
      }
    }
  }

  return amountsByAccount;
}

export class WalletSnapshotRpcService implements WalletSnapshotService {
  readonly network: SolanaNetwork;
  readonly endpoint: string;
  private readonly client: SolanaReadClient;

  constructor(options?: {
    network?: SolanaNetwork;
    endpoint?: string;
    client?: SolanaReadClient;
  }) {
    const config = getSolanaRpcConfig();
    this.network = options?.network ?? config.network;
    this.endpoint = options?.endpoint ?? config.endpoint;
    this.client = options?.client ?? new Connection(this.endpoint, { commitment: 'confirmed' });
  }

  async getSnapshot(address: string): Promise<WalletSnapshot> {
    logStage('start');
    logStage('rpc-config', {
      host: sanitizeEndpointHost(this.endpoint),
      network: this.network,
    });

    let owner: PublicKey;
    try {
      owner = new PublicKey(address.trim());
    } catch {
      throw new WalletSnapshotServiceError('invalid-address', 'Connected wallet address is invalid.');
    }

    try {
      const runtimeCrypto = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto;
      logStage('crypto-check', {
        crypto: typeof runtimeCrypto,
        getRandomValues: typeof runtimeCrypto?.getRandomValues,
      });

      logStage('getBalance start');
      const solBalanceRaw = await this.client.getBalance(owner);
      logStage('getBalance success');

      logStage('getTokenAccountsLegacy start');
      const tokenAccountsLegacy = await this.client.getParsedTokenAccountsByOwner(owner, { programId: SPL_TOKEN_PROGRAM_ID });
      logStage('getTokenAccountsLegacy success');

      logStage('getTokenAccounts2022 start');
      const tokenAccounts2022 = await this.client.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID });
      logStage('getTokenAccounts2022 success');

      const balancesByAccount = mergeTokenAccounts(tokenAccountsLegacy, tokenAccounts2022);
      const tokenAccountCount = balancesByAccount.size;
      let nonZeroTokenAccountCount = 0;

      for (const amount of balancesByAccount.values()) {
        if (amount > 0n) nonZeroTokenAccountCount += 1;
      }

      return {
        address: owner.toBase58(),
        network: this.network,
        solBalanceLamports: toLamports(solBalanceRaw),
        tokenAccountCount,
        nonZeroTokenAccountCount,
        zeroBalanceTokenAccountCount: tokenAccountCount - nonZeroTokenAccountCount,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      logFailure('snapshot', error);
      throw mapServiceError(error);
    }
  }
}

export const walletSnapshotServiceImpl: WalletSnapshotService = new WalletSnapshotRpcService();
