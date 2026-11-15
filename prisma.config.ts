import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js loads .env.local itself; the Prisma CLI does not, so load it here.
config({ path: [".env.local", ".env"], quiet: true });

// Migrations should use a direct connection when one is provided (pooled URLs
// cannot run some migration statements).
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: url ?? "" },
});
