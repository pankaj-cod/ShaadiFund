/** Cache tag for one public wedding page, keyed by its address. */
export function weddingTag(slug: string): string {
  return `wedding:${slug}`;
}
