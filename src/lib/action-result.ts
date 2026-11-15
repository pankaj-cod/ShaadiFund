/** What every server action returns, so forms can show field and form-level errors. */
export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; message: string; fields?: Record<string, string> };
