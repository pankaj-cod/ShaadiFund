import { config } from "dotenv";

// Unit and integration tests always run against the mock payment provider and the
// file email transport, whatever the developer's own .env.local says.
config({ path: [".env.local", ".env"], quiet: true });
process.env.PAYMENTS_MODE = "mock";
process.env.EMAIL_TRANSPORT = "file";
process.env.APP_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= "test-only-secret-0123456789-0123456789";
