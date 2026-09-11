export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export interface WalletSnapshot {
  address: string;
  network: SolanaNetwork;
  solBalanceLamports: bigint;
  tokenAccountCount: number;
  nonZeroTokenAccountCount: number;
  zeroBalanceTokenAccountCount: number;
  fetchedAt: string;
}

export type WalletSnapshotFailureReason = 'invalid-address' | 'invalid-response' | 'rpc-unavailable' | 'failed';

export class WalletSnapshotServiceError extends Error {
  constructor(readonly reason: WalletSnapshotFailureReason, message: string) {
    super(message);
    this.name = 'WalletSnapshotServiceError';
  }
}
