import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js loads .env.local itself; the Prisma CLI does not, so load it here.
config({ path: [".env.local", ".env"], quiet: true });

// Migrations should use a direct connection when one is provided (pooled URLs
// cannot run some migration statements).
// Neon's Vercel integration names its direct connection DATABASE_URL_UNPOOLED.
// With a prefix on that connection, the same values arrive as STORAGE_DATABASE_URL(_UNPOOLED).
const env = process.env;
const url =
  env.DIRECT_URL ||
  env.DATABASE_URL_UNPOOLED ||
  env.STORAGE_DATABASE_URL_UNPOOLED ||
  env.DATABASE_URL ||
  env.STORAGE_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: url ?? "" },
});
