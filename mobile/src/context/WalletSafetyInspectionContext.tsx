import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';

import type { WalletSafetyInspection } from '@/types/walletInspection';

interface WalletSafetyInspectionContextValue {
  inspectionsByAddress: Record<string, WalletSafetyInspection>;
  saveInspection: (inspection: WalletSafetyInspection) => void;
}

const WalletSafetyInspectionContext = createContext<WalletSafetyInspectionContextValue | null>(null);

function normalizeAddress(address: string): string {
  return address.trim();
}

export function WalletSafetyInspectionProvider({ children }: PropsWithChildren) {
  const [inspectionsByAddress, setInspectionsByAddress] = useState<Record<string, WalletSafetyInspection>>({});

  const saveInspection = useCallback((inspection: WalletSafetyInspection) => {
    const normalizedAddress = normalizeAddress(inspection.address);
    setInspectionsByAddress((current) => ({
      ...current,
      [normalizedAddress]: inspection,
    }));
  }, []);

  const value = useMemo(
    () => ({ inspectionsByAddress, saveInspection }),
    [inspectionsByAddress, saveInspection],
  );

  return <WalletSafetyInspectionContext.Provider value={value}>{children}</WalletSafetyInspectionContext.Provider>;
}

export function useWalletSafetyInspectionContext() {
  const context = useContext(WalletSafetyInspectionContext);
  if (!context) throw new Error('useWalletSafetyInspectionContext must be used within WalletSafetyInspectionProvider');
  return context;
}
