import type { TransactionInspectionExercise } from '@/types/exercise';
import type { WalletTrainingTopic } from '@/types/walletTraining';

export const walletLessonCatalog: readonly TransactionInspectionExercise[] = [
  {
    id: 'wallet-lesson-frozen-account-state',
    type: 'transaction-inspection',
    title: 'Token Account State: Frozen Does Not Mean Scam',
    skill: 'walletSafety',
    difficulty: 'Beginner',
    xpReward: 120,
    description: 'A wallet helper surfaces a token account marked frozen and asks you to decide what to do next.',
    requestingApp: 'Token Account Explorer',
    requestingDomain: 'learn.token-account.example',
    transaction: {
      network: 'solana-mainnet',
      feeSol: 0.000005,
      accountChanges: [
        {
          account: 'Token Account (example)',
          change: 'data-write',
          detail: 'Read-only simulation of account-state inspection.',
        },
      ],
      tokenTransfers: [],
      programInvocations: [
        { program: 'Token Program', verified: true, purpose: 'Account-state lookup' },
      ],
      instructions: [
        { program: 'Token Program', action: 'GetAccountData', details: ['State: Frozen'] },
      ],
    },
    expectedDecision: 'needs-review',
    explanation: 'Frozen means transfers are constrained by authority rules. It is an important review signal, not automatic proof of fraud.',
    learningPoints: [
      'A frozen token account has transfer restrictions until authority conditions are met.',
      'Frozen status alone does not classify a token as malicious.',
      'Review who controls freeze authority and why the state is frozen.',
    ],
    ruleToRemember: 'Treat frozen as context to investigate, not a verdict.',
  },
  {
    id: 'wallet-lesson-delegated-authority',
    type: 'transaction-inspection',
    title: 'Delegated Authority: Expected or Unexpected?',
    skill: 'walletSafety',
    difficulty: 'Beginner',
    xpReward: 125,
    description: 'A token permission overview shows delegated authority on one account and asks for your next action.',
    requestingApp: 'Wallet Permission Review',
    requestingDomain: 'permissions.review.example',
    transaction: {
      network: 'solana-mainnet',
      feeSol: 0.000006,
      accountChanges: [
        {
          account: 'Token Account (example)',
          change: 'delegate-set',
          detail: 'Delegate may move a capped token amount under prior approval.',
        },
      ],
      tokenTransfers: [],
      programInvocations: [
        { program: 'Token Program', verified: true, purpose: 'Delegate permission model' },
      ],
      instructions: [
        { program: 'Token Program', action: 'ApproveDelegate', details: ['Allowance exists', 'Owner remains unchanged'] },
      ],
    },
    expectedDecision: 'needs-review',
    explanation: 'Delegation can be legitimate, but unexpected delegates deserve validation before further approvals.',
    learningPoints: [
      'Delegation grants limited authority to another address or program.',
      'Not all delegation is malicious, especially in trusted workflows.',
      'Unexpected delegate permissions should be verified and, when needed, revoked.',
    ],
    ruleToRemember: 'Review delegation scope and intent before approving related actions.',
  },
  {
    id: 'wallet-lesson-token-2022-basics',
    type: 'transaction-inspection',
    title: 'Token-2022 Basics: Newer Program, More Features',
    skill: 'walletSafety',
    difficulty: 'Intermediate',
    xpReward: 130,
    description: 'A token details panel highlights that an asset uses Token-2022 and asks for your decision.',
    requestingApp: 'Token Capability Viewer',
    requestingDomain: 'token2022.learn.example',
    transaction: {
      network: 'solana-mainnet',
      feeSol: 0.000005,
      accountChanges: [],
      tokenTransfers: [],
      programInvocations: [
        { program: 'Token-2022 Program', verified: true, purpose: 'Program metadata lookup' },
      ],
      instructions: [
        { program: 'Token-2022 Program', action: 'GetMintAndExtensions', details: ['Read extension capabilities'] },
      ],
    },
    expectedDecision: 'approve',
    explanation: 'Token-2022 is a supported Solana token program with extra capabilities. Presence alone is informational, not suspicious.',
    learningPoints: [
      'Token-2022 extends token functionality through optional features.',
      'Using Token-2022 by itself does not imply a scam.',
      'Focus on enabled capabilities and intent, not just the program label.',
    ],
    ruleToRemember: 'Program version is context; behavior determines risk.',
  },
  {
    id: 'wallet-lesson-empty-token-account-context',
    type: 'transaction-inspection',
    title: 'Empty Token Accounts: Normal On-Chain Cleanup State',
    skill: 'walletSafety',
    difficulty: 'Beginner',
    xpReward: 115,
    description: 'A wallet summary shows zero-balance token accounts and asks how you should interpret them.',
    requestingApp: 'Account Inventory',
    requestingDomain: 'inventory.wallet.example',
    transaction: {
      network: 'solana-mainnet',
      feeSol: 0.000005,
      accountChanges: [],
      tokenTransfers: [],
      programInvocations: [
        { program: 'Token Program', verified: true, purpose: 'Token account enumeration' },
      ],
      instructions: [
        { program: 'Token Program', action: 'ListTokenAccounts', details: ['Some accounts have zero balance'] },
      ],
    },
    expectedDecision: 'approve',
    explanation: 'Zero-balance token accounts can remain on-chain after transfers. Their existence alone is not a warning signal.',
    learningPoints: [
      'Empty token accounts are common and often harmless.',
      'An account existing does not imply current holdings.',
      'Interpret empty accounts with surrounding context before escalating concern.',
    ],
    ruleToRemember: 'Empty account does not equal unsafe account.',
  },
  {
    id: 'wallet-lesson-frozen-token2022-context',
    type: 'transaction-inspection',
    title: 'Context Stacking: Frozen + Token-2022',
    skill: 'walletSafety',
    difficulty: 'Advanced',
    xpReward: 145,
    description: 'A token account is both frozen and under Token-2022. Choose the most responsible action.',
    requestingApp: 'Advanced Account Review',
    requestingDomain: 'advanced.wallet-review.example',
    transaction: {
      network: 'solana-mainnet',
      feeSol: 0.000008,
      accountChanges: [
        {
          account: 'Token Account (example)',
          change: 'data-write',
          detail: 'State and extension fields are reviewed together.',
        },
      ],
      tokenTransfers: [],
      programInvocations: [
        { program: 'Token-2022 Program', verified: true, purpose: 'State plus extension readout' },
      ],
      instructions: [
        { program: 'Token-2022 Program', action: 'InspectStateAndExtensions', details: ['State: Frozen', 'Program: Token-2022'] },
      ],
    },
    expectedDecision: 'needs-review',
    explanation: 'Multiple signals can coexist without proving malice. Combined context should trigger careful review, not instant assumptions.',
    learningPoints: [
      'Stacked signals increase the need for context, not panic.',
      'A frozen state and Token-2022 together still require authority and intent analysis.',
      'Use structured review before acting on mixed technical indicators.',
    ],
    ruleToRemember: 'More signals means deeper review, not automatic condemnation.',
  },
];

const topicExercises: Record<WalletTrainingTopic, readonly string[]> = {
  'token-account-state': ['wallet-lesson-frozen-account-state', 'wallet-lesson-frozen-token2022-context'],
  'delegated-authority': ['wallet-lesson-delegated-authority'],
  'token-2022': ['wallet-lesson-token-2022-basics', 'wallet-lesson-frozen-token2022-context'],
  'empty-token-account': ['wallet-lesson-empty-token-account-context'],
};

export function getWalletLessonExerciseIds(topic: WalletTrainingTopic): readonly string[] {
  return topicExercises[topic];
}

export function findWalletLessonExercise(exerciseId: string): TransactionInspectionExercise | undefined {
  return walletLessonCatalog.find((exercise) => exercise.id === exerciseId);
}
