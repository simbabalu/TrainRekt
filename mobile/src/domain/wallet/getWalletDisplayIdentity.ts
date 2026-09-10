import { ConnectedWallet } from '@/types/wallet';
import { abbreviateWalletAddress } from './abbreviateWalletAddress';

export interface WalletDisplayIdentity {
  primary: string;
  secondary?: string;
}

export function getWalletDisplayIdentity(wallet: ConnectedWallet): WalletDisplayIdentity {
  const label = wallet.label?.trim();

  if (label) {
    return {
      primary: label,
      secondary: abbreviateWalletAddress(wallet.address),
    };
  }

  return {
    primary: abbreviateWalletAddress(wallet.address),
  };
}
