import type { MobileWalletService } from './mobileWalletService';

export const mobileWalletServiceImpl: MobileWalletService = {
  async connectWallet() {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Wallet connection is only available on Android development builds.',
    };
  },
  async disconnectWallet() {
    return { ok: true };
  },
  async signMessage() {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Message signing is only available on Android development builds.',
    };
  },
};
