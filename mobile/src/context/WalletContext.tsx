import { createContext, PropsWithChildren, useContext, useRef, useState } from 'react';

import { mobileWalletService, MobileWalletService } from '@/services/wallet/mobileWalletService';
import { ConnectedWallet, WalletConnectionStatus } from '@/types/wallet';

interface WalletContextValue {
  status: WalletConnectionStatus;
  wallet: ConnectedWallet | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

interface WalletProviderProps extends PropsWithChildren {
  service?: MobileWalletService;
}

export function WalletProvider({ children, service = mobileWalletService }: WalletProviderProps) {
  const [status, setStatus] = useState<WalletConnectionStatus>('disconnected');
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const pendingConnectRef = useRef(false);

  async function connect() {
    if (pendingConnectRef.current) return;
    pendingConnectRef.current = true;
    setStatus('connecting');
    setError(null);

    try {
      const result = await service.connectWallet();
      if (!result.ok) {
        if (result.reason === 'cancelled') {
          setStatus('disconnected');
        } else {
          setStatus('error');
        }
        setError(result.message);
        setWallet(null);
        authTokenRef.current = null;
        return;
      }

      setWallet(result.wallet);
      authTokenRef.current = result.authToken ?? null;
      setError(null);
      setStatus('connected');
    } finally {
      pendingConnectRef.current = false;
    }
  }

  async function disconnect() {
    if (status === 'connecting') return;

    const result = await service.disconnectWallet(authTokenRef.current ?? undefined);
    if (!result.ok) {
      setStatus('error');
      setError(result.message);
      return;
    }

    authTokenRef.current = null;
    setWallet(null);
    setError(null);
    setStatus('disconnected');
  }

  return <WalletContext.Provider value={{ status, wallet, error, connect, disconnect }}>{children}</WalletContext.Provider>;
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
