const LAMPORTS_PER_SOL = 1_000_000_000n;
const DISPLAY_DECIMALS = 3n;
const DISPLAY_SCALE = 10n ** DISPLAY_DECIMALS;

export function formatLamportsToSol(lamports: bigint): string {
  if (lamports < 0n) return '0.000';

  const whole = lamports / LAMPORTS_PER_SOL;
  const fractional = ((lamports % LAMPORTS_PER_SOL) * DISPLAY_SCALE) / LAMPORTS_PER_SOL;

  return `${whole.toString()}.${fractional.toString().padStart(Number(DISPLAY_DECIMALS), '0')}`;
}
