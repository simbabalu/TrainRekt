import type { WalletConnectResult, WalletDisconnectResult, WalletSignMessageResult } from '@/types/wallet';
import { mobileWalletServiceImpl } from './mobileWalletService.impl';

export interface MobileWalletService {
  connectWallet: () => Promise<WalletConnectResult>;
  disconnectWallet: (authToken?: string) => Promise<WalletDisconnectResult>;
  signMessage: (message: Uint8Array, walletAddress: string, authToken?: string) => Promise<WalletSignMessageResult>;
}

export const mobileWalletService: MobileWalletService = mobileWalletServiceImpl;
