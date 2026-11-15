/**
 * The wedding page themes. Each is a set of design tokens in globals.css,
 * selected by the data-theme attribute. Keys match the ThemeKey enum in the
 * database schema.
 */

export const THEME_KEYS = ["MINIMAL_IVORY", "ROYAL_INDIAN", "MODERN_EDITORIAL"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export interface ThemeDefinition {
  key: ThemeKey;
  /** Value of the data-theme attribute. */
  attribute: string;
  name: string;
  description: string;
}

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  MINIMAL_IVORY: {
    key: "MINIMAL_IVORY",
    attribute: "minimal-ivory",
    name: "Minimal Ivory",
    description: "Warm ivory, champagne and soft gold. Quiet and timeless.",
  },
  ROYAL_INDIAN: {
    key: "ROYAL_INDIAN",
    attribute: "royal-indian",
    name: "Royal Indian",
    description: "Deep maroon and marigold gold, with a ceremonial feel.",
  },
  MODERN_EDITORIAL: {
    key: "MODERN_EDITORIAL",
    attribute: "modern-editorial",
    name: "Modern Editorial",
    description: "Crisp white, black type and sharp edges, like a magazine spread.",
  },
};

export const DEFAULT_THEME: ThemeKey = "MINIMAL_IVORY";

export function getTheme(key: string | null | undefined): ThemeDefinition {
  return THEME_KEYS.includes(key as ThemeKey) ? THEMES[key as ThemeKey] : THEMES[DEFAULT_THEME];
}
