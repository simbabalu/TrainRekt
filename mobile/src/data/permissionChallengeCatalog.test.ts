import { describe, expect, it } from 'vitest';

import { permissionChallengeCatalog } from './permissionChallengeCatalog';

describe('permissionChallengeCatalog', () => {
  it('contains unique IDs', () => {
    const ids = permissionChallengeCatalog.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains at least one allow, reject, and needs-review expected decision', () => {
    const decisions = new Set(permissionChallengeCatalog.map((exercise) => exercise.expectedDecision));
    expect(decisions.has('allow')).toBe(true);
    expect(decisions.has('reject')).toBe(true);
    expect(decisions.has('needs-review')).toBe(true);
  });

  it('pre-decision copy avoids obvious answer-leaking labels', () => {
    const blocked = /\b(suspicious|dangerous|malicious|fake|safe|trusted|red flag|phishing|legitimate)\b/i;

    permissionChallengeCatalog.forEach((exercise) => {
      expect(exercise.title).not.toMatch(blocked);
      expect(exercise.description).not.toMatch(blocked);
      expect(exercise.request.appName).not.toMatch(blocked);
      expect(exercise.request.displayedDomain ?? '').not.toMatch(blocked);
      expect(exercise.request.requestedOrigin ?? '').not.toMatch(blocked);
      exercise.request.permissions.forEach((permission) => {
        expect(permission.label).not.toMatch(blocked);
        expect(permission.detail).not.toMatch(blocked);
      });
      (exercise.request.contextualFacts ?? []).forEach((fact) => {
        expect(fact).not.toMatch(blocked);
      });
    });
  });
});
