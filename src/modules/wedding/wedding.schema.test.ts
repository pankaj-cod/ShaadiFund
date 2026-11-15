import { describe, expect, it } from "vitest";
import { slugify, slugSchema } from "./wedding.schema";

describe("slugify", () => {
  it("joins two names", () => {
    expect(slugify("Riya", "Rahul")).toBe("riya-and-rahul");
  });

  it("strips accents, punctuation and extra spaces", () => {
    expect(slugify("  Zoë  ", "D'Souza Jr.")).toBe("zoe-and-d-souza-jr");
  });

  it("falls back for names with no Latin letters", () => {
    expect(slugify("रिया", "राहुल")).toBe("our-wedding");
  });

  it("always produces something slugSchema accepts", () => {
    for (const [a, b] of [
      ["Riya", "Rahul"],
      ["A", "B"],
      ["", ""],
      ["x".repeat(80), "y".repeat(80)],
    ]) {
      expect(slugSchema.safeParse(slugify(a!, b!)).success).toBe(true);
    }
  });
});

describe("slugSchema", () => {
  it("normalises case and whitespace", () => {
    expect(slugSchema.parse("  Riya-And-Rahul ")).toBe("riya-and-rahul");
  });

  it.each(["ab", "riya--rahul", "-riya", "riya_rahul", "riya rahul", "a".repeat(61)])(
    "rejects %s",
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    },
  );

  it.each(["admin", "api", "dashboard", "wedding"])("rejects the reserved word %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });
});
