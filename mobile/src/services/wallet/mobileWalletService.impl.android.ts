import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

import type { ConnectedWallet, WalletConnectResult, WalletConnectionFailureReason, WalletDisconnectResult } from '@/types/wallet';
import type { MobileWalletService } from './mobileWalletService';

const APP_IDENTITY = {
  name: 'TrainRekt',
  // Development-safe URI until a production domain and digital asset links are configured.
  uri: 'https://localhost',
};

function toMessage(reason: WalletConnectionFailureReason): string {
  if (reason === 'cancelled') return 'Wallet connection cancelled.';
  if (reason === 'rejected') return 'Wallet authorization was rejected.';
  if (reason === 'no-wallet') return 'No compatible Solana wallet was found on this device.';
  if (reason === 'unavailable') return 'Wallet adapter is unavailable on this device.';
  if (reason === 'unsupported') return 'Wallet connection is only available on Android development builds.';
  return 'Wallet connection failed. Please try again.';
}

function normalizeAddress(account: { address: string; display_address?: string }): string {
  const displayAddress = account.display_address?.trim();
  if (displayAddress) return displayAddress;
  return account.address.trim();
}

function mapError(error: unknown): { reason: WalletConnectionFailureReason; message: string } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Unknown wallet error');
  const message = rawMessage.toLowerCase();

  if (message.includes('cancel') || message.includes('dismissed')) {
    return { reason: 'cancelled', message: toMessage('cancelled') };
  }

  if (message.includes('reject') || message.includes('declin') || message.includes('denied')) {
    return { reason: 'rejected', message: toMessage('rejected') };
  }

  if (message.includes('no wallet') || message.includes('not found') || message.includes('no compatible') || message.includes('activitynotfound')) {
    return { reason: 'no-wallet', message: toMessage('no-wallet') };
  }

  if (message.includes('unsupported')) {
    return { reason: 'unsupported', message: toMessage('unsupported') };
  }

  if (message.includes('unavailable')) {
    return { reason: 'unavailable', message: toMessage('unavailable') };
  }

  return { reason: 'failed', message: toMessage('failed') };
}

function firstAuthorizedWallet(authorizationResult: {
  accounts: { address: string; label?: string; display_address?: string }[];
  auth_token?: string;
}): { wallet: ConnectedWallet; authToken?: string } | null {
  const account = authorizationResult.accounts[0];
  if (!account) return null;
  return {
    wallet: {
      address: normalizeAddress(account),
      label: account.label,
    },
    authToken: authorizationResult.auth_token,
  };
}

export const mobileWalletServiceImpl: MobileWalletService = {
  async connectWallet(): Promise<WalletConnectResult> {
    try {
      const authorizationResult = await transact(async (wallet: Web3MobileWallet) => {
        return await wallet.authorize({
          chain: 'solana:mainnet',
          identity: APP_IDENTITY,
        });
      });

      const authorizedWallet = firstAuthorizedWallet(authorizationResult);
      if (!authorizedWallet) {
        return {
          ok: false,
          reason: 'failed',
          message: 'Wallet authorization did not return an account.',
        };
      }

      return { ok: true, wallet: authorizedWallet.wallet, authToken: authorizedWallet.authToken };
    } catch (error) {
      if (__DEV__) console.warn('MWA connect failed', error);
      const mapped = mapError(error);
      return { ok: false, reason: mapped.reason, message: mapped.message };
    }
  },

  async disconnectWallet(authToken?: string): Promise<WalletDisconnectResult> {
    if (!authToken) return { ok: true };

    // Avoid exposing auth tokens in debug logcat through upstream native deauthorize logging.
    if (__DEV__) return { ok: true };

    try {
      await transact(async (wallet: Web3MobileWallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      });
      return { ok: true };
    } catch (error) {
      if (__DEV__) console.warn('MWA disconnect failed', error);
      const mapped = mapError(error);
      return { ok: false, reason: mapped.reason, message: mapped.message };
    }
  },
};
