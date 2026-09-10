import type { WalletConnectResult, WalletDisconnectResult } from '@/types/wallet';
import { mobileWalletServiceImpl } from './mobileWalletService.impl';

export interface MobileWalletService {
  connectWallet: () => Promise<WalletConnectResult>;
  disconnectWallet: (authToken?: string) => Promise<WalletDisconnectResult>;
}

export const mobileWalletService: MobileWalletService = mobileWalletServiceImpl;
