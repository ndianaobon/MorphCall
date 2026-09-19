import { describe, expect, it } from 'vitest';
import { RelationshipPolicy } from './relationship.policy.js';

describe('RelationshipPolicy.canSeeDetails', () => {
  it.each([
    ['public', false, false, true],
    ['followers', false, false, false],
    ['followers', false, true, true],
    ['private', false, false, false],
    ['private', false, true, true],
    ['private', true, false, true],
  ] as const)('%s profile, self=%s, following=%s → %s', (vis, self, following, expected) => {
    expect(RelationshipPolicy.canSeeDetails(vis, self, following)).toBe(expected);
  });
});

describe('RelationshipPolicy.canSeeOnline', () => {
  it.each([
    ['everyone', false, false, true],
    ['followers', false, false, false],
    ['followers', false, true, true],
    ['friends', false, true, false],
    ['nobody', false, true, false],
    ['nobody', true, false, true],
  ] as const)('%s, self=%s, following=%s → %s', (aud, self, following, expected) => {
    expect(RelationshipPolicy.canSeeOnline(aud, self, following)).toBe(expected);
  });
});

describe('RelationshipPolicy.isOnline', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');
  it('is online within the window', () => {
    expect(RelationshipPolicy.isOnline('2026-09-19T11:59:00Z', now)).toBe(true);
  });
  it('is offline after the window or when never seen', () => {
    expect(RelationshipPolicy.isOnline('2026-09-19T11:55:00Z', now)).toBe(false);
    expect(RelationshipPolicy.isOnline(null, now)).toBe(false);
  });
});
