import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    ['/discover', '/discover'],
    ['/u/ava?tab=followers', '/u/ava?tab=followers'],
    [null, '/home'],
    ['https://evil.example', '/home'],
    ['//evil.example', '/home'],
    ['/\\evil.example', '/home'],
    ['javascript:alert(1)', '/home'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
