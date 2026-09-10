import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { signatureSimulationCatalog } from '@/data/signatureSimulationCatalog';
import { SignatureSimulationCard } from './SignatureSimulationCard';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

describe('SignatureSimulationCard', () => {
  it('shows neutral request facts without evaluative labels or explanations', () => {
    const exercise = signatureSimulationCatalog.find((candidate) => candidate.id === 'malicious-authority-change');
    if (!exercise) throw new Error('Expected malicious simulation exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SignatureSimulationCard exercise={exercise} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('SIMULATION');
    expect(text).toContain('SetAuthority');
    expect(text).not.toContain('RED FLAGS');
    expect(text).not.toContain('SAFE SIGNALS');
    expect(text).not.toContain(exercise.riskIndicators[0].detail);
  });

  it('shows neutral facts for the legitimate message request without revealing safe signals', () => {
    const exercise = signatureSimulationCatalog.find((candidate) => candidate.id === 'legitimate-message-signature');
    if (!exercise) throw new Error('Expected legitimate simulation exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<SignatureSimulationCard exercise={exercise} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('Message: Verify wallet ownership for TrainRekt training');
    expect(text).toContain('SOL transfer: None');
    expect(text).not.toContain('SAFE SIGNALS');
  });
});
