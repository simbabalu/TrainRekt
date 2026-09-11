import { Connection, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import {
  AccountState,
  getDefaultAccountState,
  getGroupMemberPointerState,
  getGroupPointerState,
  getInterestBearingMintConfigState,
  getMetadataPointerState,
  getNonTransferable,
  getPermanentDelegate,
  getTransferFeeConfig,
  getTransferHook,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackMint,
} from '@solana/spl-token';

import type { SolanaNetwork } from '@/types/walletSnapshot';
import type {
  DefaultAccountStateValue,
  MintAuthorityState,
  Token2022ExtensionKind,
  TokenDisplayMetadata,
  WalletMintInspection,
  WalletSafetyInspection,
  WalletTokenAccountInspection,
} from '@/types/walletInspection';
import { WalletInspectionServiceError } from '@/types/walletInspection';
import { getSolanaRpcConfig } from './solanaRpcConfig';
import type { WalletInspectionService } from './walletInspectionService';

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const MULTIPLE_ACCOUNTS_BATCH_SIZE = 100;

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

interface AccountInfoLike {
  data: Uint8Array;
  owner: PublicKey | string;
  executable?: boolean;
  lamports?: number;
  rentEpoch?: number;
}

interface BorshStringReadResult {
  value: string;
  nextOffset: number;
}

interface SolanaReadClient {
  getParsedTokenAccountsByOwner: (owner: PublicKey, filter: { programId: PublicKey }) => Promise<ParsedTokenAccountResponse>;
  getMultipleAccountsInfo?: (publicKeys: PublicKey[]) => Promise<(AccountInfoLike | null)[]>;
}

type ProgramKind = WalletTokenAccountInspection['program'];

const SUPPORTED_TOKEN_2022_EXTENSIONS: readonly Token2022ExtensionKind[] = [
  'permanent-delegate',
  'transfer-fee-config',
  'transfer-hook',
  'non-transferable',
  'default-account-state',
  'interest-bearing-config',
  'metadata-pointer',
  'group-pointer',
  'group-member-pointer',
];

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
    if (ownerAddress === TOKEN_PROGRAM_ID.toBase58()) return 'spl-token';
    if (ownerAddress === TOKEN_2022_PROGRAM_ID.toBase58()) return 'token-2022';
    return 'unknown';
  }

  if (typeof owner === 'string' && owner.trim()) {
    if (owner === TOKEN_PROGRAM_ID.toBase58()) return 'spl-token';
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
      tokenDisplayMetadata: null,
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

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function sanitizeMetadataField(value: string, maxLength: number): string | null {
  const withoutNulls = value.replace(/\u0000/g, '');
  const withoutControlChars = withoutNulls.replace(/[\u0001-\u001F\u007F]/g, '');
  const trimmed = withoutControlChars.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function readBorshString(data: Uint8Array, offset: number): BorshStringReadResult | null {
  if (offset + 4 > data.length) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const byteLength = view.getUint32(offset, true);
  const start = offset + 4;
  const end = start + byteLength;
  if (end > data.length) return null;

  return {
    value: new TextDecoder().decode(data.subarray(start, end)),
    nextOffset: end,
  };
}

function parseMetadataAccountData(data: Uint8Array, expectedMint: string): TokenDisplayMetadata | null {
  if (data.length < 1 + 32 + 32 + 4 + 4) return null;

  let offset = 0;
  offset += 1;
  offset += 32;

  const mintEnd = offset + 32;
  if (mintEnd > data.length) return null;

  let mintAddress = '';
  try {
    mintAddress = new PublicKey(data.subarray(offset, mintEnd)).toBase58();
  } catch {
    return null;
  }
  if (mintAddress !== expectedMint) return null;
  offset = mintEnd;

  const nameResult = readBorshString(data, offset);
  if (!nameResult) return null;

  const symbolResult = readBorshString(data, nameResult.nextOffset);
  if (!symbolResult) return null;

  return {
    mint: expectedMint,
    name: sanitizeMetadataField(nameResult.value, 64),
    symbol: sanitizeMetadataField(symbolResult.value, 32),
  };
}

function deriveMetadataPda(mintAddress: string): { mint: string; metadataAccount: PublicKey } | null {
  let mintPublicKey: PublicKey;
  try {
    mintPublicKey = new PublicKey(mintAddress);
  } catch {
    return null;
  }

  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintPublicKey.toBuffer()],
    METADATA_PROGRAM_ID,
  );

  return {
    mint: mintPublicKey.toBase58(),
    metadataAccount,
  };
}

async function getAccountsByProgram(
  client: SolanaReadClient,
  owner: PublicKey,
  programId: PublicKey,
): Promise<ParsedTokenAccountResponse> {
  return await client.getParsedTokenAccountsByOwner(owner, { programId });
}

function deriveMintAuthorityState(authority: PublicKey | null): MintAuthorityState {
  return authority ? 'active' : 'revoked';
}

function mapAccountState(state: number): DefaultAccountStateValue {
  if (state === AccountState.Uninitialized) return 'uninitialized';
  if (state === AccountState.Initialized) return 'initialized';
  if (state === AccountState.Frozen) return 'frozen';
  return 'unknown';
}

function deriveToken2022Extensions(mint: ReturnType<typeof unpackMint>): { extensionKinds: Token2022ExtensionKind[]; defaultAccountState: DefaultAccountStateValue | null } {
  const extensionSet = new Set<Token2022ExtensionKind>();

  if (getPermanentDelegate(mint)) extensionSet.add('permanent-delegate');
  if (getTransferFeeConfig(mint)) extensionSet.add('transfer-fee-config');
  if (getTransferHook(mint)) extensionSet.add('transfer-hook');
  if (getNonTransferable(mint)) extensionSet.add('non-transferable');
  if (getInterestBearingMintConfigState(mint)) extensionSet.add('interest-bearing-config');
  if (getMetadataPointerState(mint)) extensionSet.add('metadata-pointer');
  if (getGroupPointerState(mint)) extensionSet.add('group-pointer');
  if (getGroupMemberPointerState(mint)) extensionSet.add('group-member-pointer');

  const defaultAccountState = getDefaultAccountState(mint);
  if (defaultAccountState) {
    extensionSet.add('default-account-state');
  }

  return {
    extensionKinds: SUPPORTED_TOKEN_2022_EXTENSIONS.filter((kind) => extensionSet.has(kind)),
    defaultAccountState: defaultAccountState ? mapAccountState(defaultAccountState.state) : null,
  };
}

function toBufferData(data: Uint8Array): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

function createUnavailableMintInspection(
  mintAddress: string,
  program: ProgramKind,
  unavailableReason: string,
): WalletMintInspection {
  return {
    mintAddress,
    program,
    decimals: null,
    supplyRaw: null,
    mintAuthorityState: 'unknown',
    mintAuthorityAddress: null,
    freezeAuthorityState: 'unknown',
    freezeAuthorityAddress: null,
    token2022Extensions: [],
    defaultAccountState: null,
    unavailableReason,
  };
}

export class WalletInspectionRpcService implements WalletInspectionService {
  readonly network: SolanaNetwork;
  readonly endpoint: string;
  private readonly client: SolanaReadClient;
  private readonly tokenMetadataCacheByMint = new Map<string, TokenDisplayMetadata | null>();

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

  private async resolveTokenDisplayMetadataByMint(
    mintAddresses: string[],
    warnings: string[],
  ): Promise<Map<string, TokenDisplayMetadata | null>> {
    const metadataByMint = new Map<string, TokenDisplayMetadata | null>();
    const uncachedMints: string[] = [];

    for (const mintAddress of mintAddresses) {
      if (this.tokenMetadataCacheByMint.has(mintAddress)) {
        metadataByMint.set(mintAddress, this.tokenMetadataCacheByMint.get(mintAddress) ?? null);
      } else {
        uncachedMints.push(mintAddress);
      }
    }

    if (uncachedMints.length === 0) return metadataByMint;

    if (!this.client.getMultipleAccountsInfo) {
      for (const mintAddress of uncachedMints) {
        this.tokenMetadataCacheByMint.set(mintAddress, null);
        metadataByMint.set(mintAddress, null);
      }
      warnings.push('Token metadata lookup is unavailable on this RPC client.');
      return metadataByMint;
    }

    const metadataTargets = uncachedMints
      .map((mintAddress) => deriveMetadataPda(mintAddress))
      .filter((target): target is { mint: string; metadataAccount: PublicKey } => Boolean(target));

    for (const mintAddress of uncachedMints) {
      if (metadataTargets.some((target) => target.mint === mintAddress)) continue;
      this.tokenMetadataCacheByMint.set(mintAddress, null);
      metadataByMint.set(mintAddress, null);
    }

    for (const batch of chunkArray(metadataTargets, MULTIPLE_ACCOUNTS_BATCH_SIZE)) {
      try {
        const accounts = await this.client.getMultipleAccountsInfo(batch.map((target) => target.metadataAccount));
        for (let index = 0; index < batch.length; index += 1) {
          const target = batch[index];
          const accountInfo = accounts[index];
          const metadata = accountInfo ? parseMetadataAccountData(accountInfo.data, target.mint) : null;
          this.tokenMetadataCacheByMint.set(target.mint, metadata);
          metadataByMint.set(target.mint, metadata);
        }
      } catch {
        warnings.push('Token metadata lookup failed; showing canonical mint identifiers only.');
        for (const target of batch) {
          this.tokenMetadataCacheByMint.set(target.mint, null);
          metadataByMint.set(target.mint, null);
        }
      }
    }

    return metadataByMint;
  }

  private async resolveMintInspections(
    tokenAccounts: WalletTokenAccountInspection[],
    warnings: string[],
  ): Promise<WalletMintInspection[]> {
    const mintAddresses = Array.from(new Set(tokenAccounts.map((account) => account.mintAddress)));
    if (mintAddresses.length === 0) return [];

    const inferredProgramByMint = new Map<string, ProgramKind>();
    for (const tokenAccount of tokenAccounts) {
      const existing = inferredProgramByMint.get(tokenAccount.mintAddress);
      if (existing && existing !== 'unknown') continue;
      inferredProgramByMint.set(tokenAccount.mintAddress, tokenAccount.program);
    }

    if (!this.client.getMultipleAccountsInfo) {
      warnings.push('Mint lookup is unavailable on this RPC client.');
      return mintAddresses.map((mintAddress) => createUnavailableMintInspection(
        mintAddress,
        inferredProgramByMint.get(mintAddress) ?? 'unknown',
        'Mint account lookup unavailable on this RPC client.',
      ));
    }

    const mintInspections = new Map<string, WalletMintInspection>();

    const mintPublicKeys = mintAddresses.map((address) => new PublicKey(address));
    for (const batch of chunkArray(mintPublicKeys, MULTIPLE_ACCOUNTS_BATCH_SIZE)) {
      let accountsInfo: (AccountInfoLike | null)[];
      try {
        accountsInfo = await this.client.getMultipleAccountsInfo(batch);
      } catch {
        warnings.push('Mint account lookup failed; mint details are unavailable for this batch.');
        for (const mintPublicKey of batch) {
          const mintAddress = mintPublicKey.toBase58();
          mintInspections.set(
            mintAddress,
            createUnavailableMintInspection(
              mintAddress,
              inferredProgramByMint.get(mintAddress) ?? 'unknown',
              'Mint account lookup failed.',
            ),
          );
        }
        continue;
      }

      for (let index = 0; index < batch.length; index += 1) {
        const mintPublicKey = batch[index];
        const mintAddress = mintPublicKey.toBase58();
        const accountInfo = accountsInfo[index];
        const inferredProgram = inferredProgramByMint.get(mintAddress) ?? 'unknown';
        if (!accountInfo) {
          mintInspections.set(
            mintAddress,
            createUnavailableMintInspection(mintAddress, inferredProgram, 'Mint account was not found.'),
          );
          warnings.push(`Mint ${mintAddress} was not returned by RPC; mint details unavailable.`);
          continue;
        }

        const accountProgram = parseProgramKindFromOwner(accountInfo.owner, inferredProgram);
        if (accountProgram === 'unknown') {
          mintInspections.set(
            mintAddress,
            createUnavailableMintInspection(mintAddress, inferredProgram, 'Mint owner program is unsupported.'),
          );
          warnings.push(`Mint ${mintAddress} uses an unsupported owner program; mint details unavailable.`);
          continue;
        }

        try {
          const mint = unpackMint(
            mintPublicKey,
            {
              ...accountInfo,
              data: toBufferData(accountInfo.data),
              owner: accountInfo.owner instanceof PublicKey ? accountInfo.owner : new PublicKey(accountInfo.owner),
              executable: accountInfo.executable ?? false,
              lamports: accountInfo.lamports ?? 0,
              rentEpoch: accountInfo.rentEpoch ?? 0,
            },
            accountProgram === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
          );

          const token2022Facts = accountProgram === 'token-2022'
            ? deriveToken2022Extensions(mint)
            : { extensionKinds: [], defaultAccountState: null as DefaultAccountStateValue | null };

          mintInspections.set(mintAddress, {
            mintAddress,
            program: accountProgram,
            decimals: mint.decimals,
            supplyRaw: mint.supply.toString(),
            mintAuthorityState: deriveMintAuthorityState(mint.mintAuthority),
            mintAuthorityAddress: mint.mintAuthority?.toBase58() ?? null,
            freezeAuthorityState: deriveMintAuthorityState(mint.freezeAuthority),
            freezeAuthorityAddress: mint.freezeAuthority?.toBase58() ?? null,
            token2022Extensions: token2022Facts.extensionKinds,
            defaultAccountState: token2022Facts.defaultAccountState,
            unavailableReason: null,
          });
        } catch {
          mintInspections.set(
            mintAddress,
            createUnavailableMintInspection(mintAddress, accountProgram, 'Mint decode failed.'),
          );
          warnings.push(`Mint ${mintAddress} could not be decoded; mint details unavailable.`);
        }
      }
    }

    return mintAddresses.map((mintAddress) => (
      mintInspections.get(mintAddress)
      ?? createUnavailableMintInspection(mintAddress, inferredProgramByMint.get(mintAddress) ?? 'unknown', 'Mint inspection unavailable.')
    ));
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
        getAccountsByProgram(this.client, owner, TOKEN_PROGRAM_ID),
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

      const tokenAccounts = Array.from(accounts.values());
      const mintInspections = await this.resolveMintInspections(tokenAccounts, warnings);
      const uniqueMints = Array.from(new Set(tokenAccounts.map((account) => account.mintAddress)));
      const metadataByMint = await this.resolveTokenDisplayMetadataByMint(uniqueMints, warnings);

      return {
        address: owner.toBase58(),
        network: this.network,
        tokenAccounts: tokenAccounts.map((account) => ({
          ...account,
          tokenDisplayMetadata: metadataByMint.get(account.mintAddress) ?? null,
        })),
        mintInspections,
        inspectedAt: new Date().toISOString(),
        warnings,
      };
    } catch (error) {
      throw mapInspectionError(error);
    }
  }
}

export const walletInspectionServiceImpl: WalletInspectionService = new WalletInspectionRpcService();
