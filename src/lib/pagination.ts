/**
 * Keyset pagination on (timestamp, id). Stable while rows are being added, and
 * as fast on page 500 as on page 1, unlike OFFSET.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPosition {
  at: Date;
  id: string;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(`${position.at.toISOString()}|${position.id}`).toString("base64url");
}

/** Returns null for anything malformed, which callers treat as "start from the top". */
export function decodeCursor(cursor: string | null | undefined): CursorPosition | null {
  if (!cursor) return null;
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const at = new Date(iso ?? "");
    if (!id || Number.isNaN(at.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) return null;
    return { at, id };
  } catch {
    return null;
  }
}

/** Given limit+1 rows, returns the page and a cursor for the next one if there is more. */
export function toPage<T>(rows: T[], limit: number, position: (row: T) => CursorPosition): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(position(last)) : null };
}
