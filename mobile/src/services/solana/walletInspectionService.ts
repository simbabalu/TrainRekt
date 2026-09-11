import type { SolanaNetwork } from '@/types/walletSnapshot';
import type { WalletSafetyInspection } from '@/types/walletInspection';
import { walletInspectionServiceImpl } from './walletInspectionService.impl';

export interface WalletInspectionService {
  network: SolanaNetwork;
  endpoint: string;
  getInspection: (address: string) => Promise<WalletSafetyInspection>;
}

export const walletInspectionService: WalletInspectionService = walletInspectionServiceImpl;
