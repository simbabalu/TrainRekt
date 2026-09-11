import { deriveWalletSafetySignals } from './deriveWalletSafetySignals';
import type {
  CategorizedWalletInspectionAccounts,
  WalletInspectionAccountPrimaryCategory,
  WalletSafetySignalCategory,
  WalletTokenAccountInspection,
} from '@/types/walletInspection';

const PRIMARY_CATEGORY_PRECEDENCE: readonly WalletInspectionAccountPrimaryCategory[] = [
  'review',
  'informational',
  'normal',
];

const SIGNAL_TO_PRIMARY_CATEGORY: Record<WalletSafetySignalCategory, WalletInspectionAccountPrimaryCategory> = {
  review: 'review',
  informational: 'informational',
};

function resolvePrimaryCategory(account: WalletTokenAccountInspection): WalletInspectionAccountPrimaryCategory {
  const signals = deriveWalletSafetySignals([account]);
  const matchedPrimaryCategories = new Set<WalletInspectionAccountPrimaryCategory>(
    signals.map((signal) => SIGNAL_TO_PRIMARY_CATEGORY[signal.category]),
  );

  for (const category of PRIMARY_CATEGORY_PRECEDENCE) {
    if (category === 'normal') return 'normal';
    if (matchedPrimaryCategories.has(category)) return category;
  }

  return 'normal';
}

export function categorizeWalletInspectionAccounts(
  accounts: WalletTokenAccountInspection[],
): CategorizedWalletInspectionAccounts {
  const reviewAccounts: WalletTokenAccountInspection[] = [];
  const informationalAccounts: WalletTokenAccountInspection[] = [];
  const normalAccounts: WalletTokenAccountInspection[] = [];

  for (const account of accounts) {
    const category = resolvePrimaryCategory(account);
    if (category === 'review') {
      reviewAccounts.push(account);
      continue;
    }

    if (category === 'informational') {
      informationalAccounts.push(account);
      continue;
    }

    normalAccounts.push(account);
  }

  return {
    reviewAccounts,
    informationalAccounts,
    normalAccounts,
    summary: {
      inspectedAccountCount: accounts.length,
      reviewAccountCount: reviewAccounts.length,
      informationalAccountCount: informationalAccounts.length,
      noReviewSignalAccountCount: normalAccounts.length,
    },
  };
}
