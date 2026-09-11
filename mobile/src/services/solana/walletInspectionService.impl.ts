import { Connection, PublicKey } from '@solana/web3.js';

import type { SolanaNetwork } from '@/types/walletSnapshot';
import type { WalletSafetyInspection, WalletTokenAccountInspection } from '@/types/walletInspection';
import { WalletInspectionServiceError } from '@/types/walletInspection';
import { getSolanaRpcConfig } from './solanaRpcConfig';
import type { WalletInspectionService } from './walletInspectionService';

const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

interface ParsedTokenAccountEntry {
  pubkey?: PublicKey;
  account?: {
    owner?: PublicKey | string;
    data?: {
      parsed?: {
        info?: Record<string, unknown>;
      };
    };
  };
}

interface ParsedTokenAccountResponse {
  value?: ParsedTokenAccountEntry[];
}

interface SolanaReadClient {
  getParsedTokenAccountsByOwner: (owner: PublicKey, filter: { programId: PublicKey }) => Promise<ParsedTokenAccountResponse>;
}

type ProgramKind = WalletTokenAccountInspection['program'];

function mapInspectionError(error: unknown): WalletInspectionServiceError {
  if (error instanceof WalletInspectionServiceError) return error;
  if (error instanceof Error && /(fetch|network|timeout|429|503|unavailable|rate limit|failed to get)/i.test(error.message)) {
    return new WalletInspectionServiceError('rpc-unavailable', 'Wallet inspection is temporarily unavailable. Please try again.');
  }
  return new WalletInspectionServiceError('failed', 'Wallet inspection failed. Please try again.');
}

function parseProgramKindFromOwner(owner: unknown, fallback: ProgramKind): ProgramKind {
  if (owner instanceof PublicKey) {
    const ownerAddress = owner.toBase58();
    if (ownerAddress === SPL_TOKEN_PROGRAM_ID.toBase58()) return 'spl-token';
    if (ownerAddress === TOKEN_2022_PROGRAM_ID.toBase58()) return 'token-2022';
    return 'unknown';
  }

  if (typeof owner === 'string' && owner.trim()) {
    if (owner === SPL_TOKEN_PROGRAM_ID.toBase58()) return 'spl-token';
    if (owner === TOKEN_2022_PROGRAM_ID.toBase58()) return 'token-2022';
    return 'unknown';
  }

  return fallback;
}

function parseBase58Address(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    return null;
  }
}

function parseRawAmount(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!/^\d+$/.test(value)) return null;
  return value;
}

function parseDecimals(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

function parseUiAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function parseState(value: unknown): WalletTokenAccountInspection['state'] {
  if (typeof value !== 'string') return 'unknown';
  if (value === 'initialized') return 'initialized';
  if (value === 'frozen') return 'frozen';
  return 'unknown';
}

function parseInspectionEntry(
  entry: ParsedTokenAccountEntry,
  fallbackProgram: ProgramKind,
): { account: WalletTokenAccountInspection | null; warning: string | null } {
  const tokenAccountAddress = entry.pubkey instanceof PublicKey ? entry.pubkey.toBase58() : null;
  if (!tokenAccountAddress) {
    return { account: null, warning: 'Skipped token account entry: missing token account address.' };
  }

  const info = entry.account?.data?.parsed?.info;
  if (!info) {
    return { account: null, warning: `Skipped ${tokenAccountAddress}: missing parsed account info.` };
  }

  const mintAddress = parseBase58Address(info.mint);
  if (!mintAddress) {
    return { account: null, warning: `Skipped ${tokenAccountAddress}: missing or invalid mint address.` };
  }

  const tokenAmount = (typeof info.tokenAmount === 'object' && info.tokenAmount) ? info.tokenAmount as Record<string, unknown> : null;
  if (!tokenAmount) {
    return { account: null, warning: `Skipped ${tokenAccountAddress}: missing tokenAmount.` };
  }

  const rawAmount = parseRawAmount(tokenAmount.amount);
  const decimals = parseDecimals(tokenAmount.decimals);
  if (rawAmount == null || decimals == null) {
    return { account: null, warning: `Skipped ${tokenAccountAddress}: malformed token amount fields.` };
  }

  const delegateAddress = parseBase58Address(info.delegate);
  const delegatedAmount = (typeof info.delegatedAmount === 'object' && info.delegatedAmount)
    ? info.delegatedAmount as Record<string, unknown>
    : null;
  const delegatedAmountRaw = parseRawAmount(delegatedAmount?.amount ?? null);

  return {
    account: {
      tokenAccountAddress,
      mintAddress,
      program: parseProgramKindFromOwner(entry.account?.owner, fallbackProgram),
      rawAmount,
      decimals,
      uiAmount: parseUiAmount(tokenAmount.uiAmount),
      state: parseState(info.state),
      delegateAddress,
      delegatedAmountRaw,
      closeAuthorityAddress: parseBase58Address(info.closeAuthority),
    },
    warning: null,
  };
}

function mergeTokenAccounts(
  existing: Map<string, WalletTokenAccountInspection>,
  next: WalletTokenAccountInspection,
  warnings: string[],
) {
  const existingEntry = existing.get(next.tokenAccountAddress);
  if (!existingEntry) {
    existing.set(next.tokenAccountAddress, next);
    return;
  }

  if (existingEntry.program !== next.program && next.program !== 'unknown') {
    existing.set(next.tokenAccountAddress, {
      ...existingEntry,
      program: next.program,
    });
  }

  warnings.push(
    `Duplicate token account ${next.tokenAccountAddress} appeared in multiple token-program queries; merged into one row.`,
  );
}

async function getAccountsByProgram(
  client: SolanaReadClient,
  owner: PublicKey,
  programId: PublicKey,
): Promise<ParsedTokenAccountResponse> {
  return await client.getParsedTokenAccountsByOwner(owner, { programId });
}

export class WalletInspectionRpcService implements WalletInspectionService {
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

  async getInspection(address: string): Promise<WalletSafetyInspection> {
    let owner: PublicKey;
    try {
      owner = new PublicKey(address.trim());
    } catch {
      throw new WalletInspectionServiceError('invalid-address', 'Connected wallet address is invalid.');
    }

    const warnings: string[] = [];

    try {
      const [legacyResult, token2022Result] = await Promise.allSettled([
        getAccountsByProgram(this.client, owner, SPL_TOKEN_PROGRAM_ID),
        getAccountsByProgram(this.client, owner, TOKEN_2022_PROGRAM_ID),
      ]);

      const accounts = new Map<string, WalletTokenAccountInspection>();
      let successCount = 0;

      if (legacyResult.status === 'fulfilled') {
        successCount += 1;
        for (const entry of legacyResult.value.value ?? []) {
          const parsed = parseInspectionEntry(entry, 'spl-token');
          if (!parsed.account) {
            if (parsed.warning) warnings.push(parsed.warning);
            continue;
          }
          mergeTokenAccounts(accounts, parsed.account, warnings);
        }
      } else {
        warnings.push('Legacy SPL token account inspection could not be completed.');
      }

      if (token2022Result.status === 'fulfilled') {
        successCount += 1;
        for (const entry of token2022Result.value.value ?? []) {
          const parsed = parseInspectionEntry(entry, 'token-2022');
          if (!parsed.account) {
            if (parsed.warning) warnings.push(parsed.warning);
            continue;
          }
          mergeTokenAccounts(accounts, parsed.account, warnings);
        }
      } else {
        warnings.push('Token-2022 account inspection could not be completed.');
      }

      if (successCount === 0) {
        const combinedReason = `${legacyResult.status === 'rejected' ? String(legacyResult.reason) : ''} ${token2022Result.status === 'rejected' ? String(token2022Result.reason) : ''}`;
        throw new Error(combinedReason.trim() || 'No token-account query succeeded.');
      }

      return {
        address: owner.toBase58(),
        network: this.network,
        tokenAccounts: Array.from(accounts.values()),
        inspectedAt: new Date().toISOString(),
        warnings,
      };
    } catch (error) {
      throw mapInspectionError(error);
    }
  }
}

export const walletInspectionServiceImpl: WalletInspectionService = new WalletInspectionRpcService();
