import { describe, expect, it } from 'vitest';
import { ageOn, profileUpdateInput, usernameSchema } from './profile.js';
import { discoverQuery } from './social.js';

describe('usernameSchema', () => {
  it('normalises case and accepts valid names', () => {
    expect(usernameSchema.parse('Ava_Lopez.1')).toBe('ava_lopez.1');
  });
  it.each(['ab', 'has space', 'émile', 'a'.repeat(25), 'dash-name'])('rejects %s', (v) => {
    expect(usernameSchema.safeParse(v).success).toBe(false);
  });
});

describe('ageOn', () => {
  const dob = new Date('2008-06-15T00:00:00Z');
  it('is 17 the day before the 18th birthday', () => {
    expect(ageOn(dob, new Date('2026-06-14T00:00:00Z'))).toBe(17);
  });
  it('is 18 on the birthday', () => {
    expect(ageOn(dob, new Date('2026-06-15T00:00:00Z'))).toBe(18);
  });
});

describe('profileUpdateInput', () => {
  it('rejects an empty update', () => {
    expect(profileUpdateInput.safeParse({}).success).toBe(false);
  });
  it('rejects unknown onboarding steps', () => {
    expect(profileUpdateInput.safeParse({ onboardingStep: 'nope' }).success).toBe(false);
  });
});

describe('discoverQuery', () => {
  it('parses interests and online flags', () => {
    const q = discoverQuery.parse({ interests: 'music,gaming', online: 'true' });
    expect(q.interests).toEqual(['music', 'gaming']);
    expect(q.online).toBe(true);
    expect(q.limit).toBe(20);
  });
});
