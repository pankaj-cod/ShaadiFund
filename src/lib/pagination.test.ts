import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, toPage } from "./pagination";

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const row = (n: number) => ({ id: id(n), createdAt: new Date(Date.UTC(2026, 0, n)) });
const position = (r: ReturnType<typeof row>) => ({ at: r.createdAt, id: r.id });

describe("pagination", () => {
  it("round-trips a cursor", () => {
    const original = { at: new Date("2026-11-15T13:43:00.489Z"), id: id(7) };
    expect(decodeCursor(encodeCursor(original))).toEqual(original);
  });

  it.each([
    undefined,
    null,
    "",
    "not-base64!",
    Buffer.from("garbage").toString("base64url"),
    Buffer.from("2026-01-01T00:00:00.000Z|not-a-uuid").toString("base64url"),
    Buffer.from(`nonsense|${id(1)}`).toString("base64url"),
  ])("treats a malformed cursor (%s) as the start", (cursor) => {
    expect(decodeCursor(cursor)).toBeNull();
  });

  it("returns a next cursor only when there is another page", () => {
    const three = [row(3), row(2), row(1)];
    const full = toPage(three, 2, position);
    expect(full.items).toHaveLength(2);
    expect(decodeCursor(full.nextCursor)).toEqual(position(row(2)));

    const last = toPage(three.slice(1), 2, position);
    expect(last.items).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
    expect(toPage([], 2, position)).toEqual({ items: [], nextCursor: null });
  });
});
