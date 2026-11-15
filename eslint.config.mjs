import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Layering rule (ADR 0001): only repositories and the db module may touch Prisma.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/db.ts", "src/modules/**/*.repository.ts", "src/generated/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/prisma/client", "@prisma/client", "@prisma/adapter-pg"],
              message: "Only *.repository.ts files and src/lib/db.ts may import the Prisma client.",
            },
          ],
        },
      ],
    },
  },
  {
    // UI must go through services, never straight to the database.
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db", "@/generated/prisma/*", "**/*.repository"],
              message: "Components call services, not the database or repositories.",
            },
          ],
        },
      ],
    },
  },
  { files: ["src/lib/logger.ts"], rules: { "no-console": "off" } },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
