/** Opaque keyset-pagination cursors (docs/03 §4: never OFFSET). */
export function encodeCursor(parts: (string | number)[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

export function decodeCursor(
  cursor: string | undefined,
  arity: number,
): (string | number)[] | null {
  if (!cursor) return null;
  try {
    const parts: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parts) &&
      parts.length === arity &&
      parts.every((p) => typeof p === 'string' || typeof p === 'number')
    ) {
      return parts as (string | number)[];
    }
  } catch {
    // fall through
  }
  return null;
}
