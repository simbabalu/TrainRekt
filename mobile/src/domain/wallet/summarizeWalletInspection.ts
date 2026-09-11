import type { WalletInspectionSummary, WalletTokenAccountInspection } from '@/types/walletInspection';

export function summarizeWalletInspection(accounts: WalletTokenAccountInspection[]): WalletInspectionSummary {
  let emptyTokenAccounts = 0;
  let frozenTokenAccounts = 0;
  let delegatedTokenAccounts = 0;
  let token2022TokenAccounts = 0;

  for (const account of accounts) {
    if (account.rawAmount === '0') emptyTokenAccounts += 1;
    if (account.state === 'frozen') frozenTokenAccounts += 1;
    if (account.delegateAddress) delegatedTokenAccounts += 1;
    if (account.program === 'token-2022') token2022TokenAccounts += 1;
  }

  return {
    reviewedTokenAccounts: accounts.length,
    emptyTokenAccounts,
    frozenTokenAccounts,
    delegatedTokenAccounts,
    token2022TokenAccounts,
  };
}
