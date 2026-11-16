// Grants or removes the admin role. There is deliberately no screen or API for
// this: it needs direct database access (ADR 0002).
//
//   npm run admin:promote -- person@example.com
//   npm run admin:promote -- person@example.com --revoke
import { config } from "dotenv";
import pg from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const [email, flag] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:promote -- <email> [--revoke]");
  process.exit(1);
}
const role = flag === "--revoke" ? "COUPLE" : "ADMIN";
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const result = await client.query(
    `UPDATE "User" SET "role" = $1::"UserRole", "updatedAt" = now() WHERE lower("email") = lower($2) RETURNING "id"`,
    [role, email],
  );
  if (result.rowCount === 0) {
    console.error(`No user with the email ${email}. They must sign in once before being promoted.`);
    process.exitCode = 1;
  } else {
    await client.query(
      `INSERT INTO "AuditLog" ("id", "actorType", "action", "entityType", "entityId", "metadata")
       VALUES (gen_random_uuid(), 'SYSTEM', $1, 'User', $2, '{"via":"promote-admin script"}')`,
      [role === "ADMIN" ? "user.promoted_to_admin" : "user.admin_revoked", result.rows[0].id],
    );
    console.error(`${email} is now ${role === "ADMIN" ? "an admin" : "a regular user"}.`);
  }
} finally {
  await client.end();
}
