import { SurpriseChallenge } from '@/types/surpriseChallenge';

export const surpriseChallengeCatalog: SurpriseChallenge[] = [
  {
    id: 'surprise-airdrop-001',
    version: 1,
    kind: 'fake-airdrop',
    trigger: 'wallet-connected',
    oneTimeOnly: true,
    delay: {
      minMs: 1500,
      maxMs: 3000,
    },
    presentation: {
      title: 'CONGRATULATIONS',
      message: 'You have been selected for a limited ecosystem reward simulation. Sign to verify wallet ownership and claim your training allocation.',
      sourceLabel: 'TrainRekt Rewards Program',
      domain: 'trainrekt-rewards.example',
      rewardLabel: '2,500 TRAINING CREDITS',
      countdownSeconds: 84,
      facts: [
        'Eligibility appears to expire shortly.',
        'No prior in-app reward announcement was shown.',
        'Request asks for wallet ownership verification signature.',
      ],
    },
    decisions: ['sign', 'inspect', 'reject'],
    outcome: {
      preferredDecision: 'reject',
      acceptableDecisions: ['reject'],
      presentation: {
        preferred: {
          headline: 'EXCELLENT DECISION',
          summary: 'You rejected the unexpected signing request immediately.',
        },
        acceptable: {
          headline: 'GOOD DECISION',
          summary: 'You inspected the unexpected request before rejecting it.',
        },
        failed: {
          headline: 'RISKY DECISION',
          summary: 'You chose to sign an unexpected request under artificial time pressure.',
        },
      },
      xp: {
        preferred: 300,
        acceptable: 250,
        failed: 50,
      },
    },
    explanation: 'This challenge simulated a social-engineering airdrop lure. The reward, urgency, and signature request were designed to push a quick decision.',
    manipulationTechniques: [
      'Unexpected reward framing',
      'Artificial countdown pressure',
      'Authority language and selection language',
      'Signature request framed as harmless verification',
    ],
    learningPoints: [
      'Unexpected reward claims deserve independent verification.',
      'Countdown timers can be fabricated to force rushed action.',
      'Message signatures can authorize risky off-chain actions.',
    ],
    ruleToRemember: 'Pause on unexpected signing requests. Inspect origin and purpose before approving any signature.',
    badge: {
      id: 'airdrop-survivor',
      name: 'Airdrop Survivor',
      description: 'Completed the fake airdrop surprise challenge with a safe final rejection.',
    },
  },
];
