/** Hosts that only mean something on this machine or this wifi. */
const LOCAL_HOST =
  /^(localhost|127\.0\.0\.1|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function isLocalHostname(hostname: string) {
  return LOCAL_HOST.test(hostname);
}

/**
 * Picks the URL to talk to.
 *
 * A configured value that points at a real host (a deployed API) always wins. A configured
 * local value does not, because in development the same build is opened from several
 * addresses — localhost on this machine, a wifi address on a phone — and those change. There
 * we follow the address the page itself was loaded from.
 */
export function resolveUrl(options: {
  configured?: string;
  port: number;
  fallback: string;
  /** window.location on the client; undefined while rendering on the server. */
  location?: { protocol: string; hostname: string };
}): string {
  const { configured, port, fallback, location } = options;

  if (configured) {
    try {
      if (!isLocalHostname(new URL(configured).hostname)) return configured;
    } catch {
      // A malformed value falls through to the derived URL.
    }
  }
  if (!location) return configured ?? fallback;
  return `${location.protocol}//${location.hostname}:${port}`;
}
