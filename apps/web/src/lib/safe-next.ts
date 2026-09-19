/** Only allow same-origin relative redirects (prevents open-redirects via ?next=). */
export function safeNext(next: string | null | undefined, fallback = '/home'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback;
  return next;
}
