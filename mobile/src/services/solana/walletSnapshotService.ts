import type { SolanaNetwork, WalletSnapshot } from '@/types/walletSnapshot';
import { walletSnapshotServiceImpl } from './walletSnapshotService.impl';

export interface WalletSnapshotService {
  network: SolanaNetwork;
  endpoint: string;
  getSnapshot: (address: string) => Promise<WalletSnapshot>;
}

export const walletSnapshotService: WalletSnapshotService = walletSnapshotServiceImpl;
