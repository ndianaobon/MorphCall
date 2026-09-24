import { describe, expect, it } from 'vitest';
import { resolveUrl } from './resolve-url';

const local = { protocol: 'http:', hostname: 'localhost' };
const phone = { protocol: 'http:', hostname: '10.190.212.39' };
const deployed = { protocol: 'https:', hostname: 'morphcall.vercel.app' };

describe('resolveUrl', () => {
  it('uses a deployed API URL as configured', () => {
    expect(
      resolveUrl({
        configured: 'https://api.morphcall.app',
        port: 4000,
        fallback: 'http://localhost:4000',
        location: deployed,
      }),
    ).toBe('https://api.morphcall.app');
  });

  it('ignores a localhost setting when the page is open on a wifi address', () => {
    expect(
      resolveUrl({
        configured: 'http://localhost:4000',
        port: 4000,
        fallback: 'http://localhost:4000',
        location: phone,
      }),
    ).toBe('http://10.190.212.39:4000');
  });

  it('ignores a stale wifi address after the router hands out a new one', () => {
    expect(
      resolveUrl({
        configured: 'http://192.168.0.67:4000',
        port: 4000,
        fallback: 'http://localhost:4000',
        location: phone,
      }),
    ).toBe('http://10.190.212.39:4000');
  });

  it('keeps localhost on this machine', () => {
    expect(
      resolveUrl({
        configured: 'http://localhost:4000',
        port: 4000,
        fallback: 'http://localhost:4000',
        location: local,
      }),
    ).toBe('http://localhost:4000');
  });

  it('falls back to the configured value while rendering on the server', () => {
    expect(
      resolveUrl({ configured: 'http://localhost:4000', port: 4000, fallback: 'http://x:4000' }),
    ).toBe('http://localhost:4000');
  });

  it('survives a malformed setting', () => {
    expect(
      resolveUrl({ configured: 'not a url', port: 3000, fallback: 'http://localhost:3000', location: phone }),
    ).toBe('http://10.190.212.39:3000');
  });
});
