# ShaadiFund

_Give them memories, not things._

A wedding gifting platform for Indian couples. A couple publishes a page of dreams; guests contribute towards them with a personal message.

- Where the project stands: [PROJECT_STATUS.md](PROJECT_STATUS.md)
- How it is built: [ARCHITECTURE.md](ARCHITECTURE.md), decisions in [docs/adr](docs/adr), API in [docs/API.md](docs/API.md)

- Putting it online: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Requirements

- Node.js 24 or newer
- Docker (for the local Postgres database)

## Run it locally

```bash
cp .env.example .env.local
```

```bash
npm install
```

```bash
npm run db:up
```

```bash
npm run db:deploy
```

```bash
npm run dev
```

Open http://localhost:3000. The design system reference is at http://localhost:3000/design and the health check at http://localhost:3000/api/health.

### Signing in locally

Sign-in uses an emailed link. In development no email is sent: each message is written as a JSON file to `.data/outbox/`. Enter any email at http://localhost:3000/sign-in, then open the newest file in that folder and paste the link from its `text` field into your browser.

Uploaded photos are stored in `.data/uploads/`. Both folders are git-ignored.

### Trying a gift locally

With `PAYMENTS_MODE=mock`, open a published wedding page, choose **Contribute** on a dream and fill in the form. The next screen is a clearly labelled demo payment with two buttons: simulate a success or a failure. No money moves. The guest's receipt and the couple's notification appear as files in `.data/outbox/`.

## Commands

| Command                            | What it does                                                         |
| ---------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                      | Start the development server                                         |
| `npm run build`                    | Production build                                                     |
| `npm run check`                    | Lint, type check, format check and unit/integration tests            |
| `npm test`                         | Unit and integration tests (integration tests need the database up)  |
| `npm run test:e2e`                 | Browser tests against a production build, on phone and desktop sizes |
| `npm run format`                   | Format every file                                                    |
| `npm run db:up`                    | Start local Postgres on port 54329                                   |
| `npm run db:down`                  | Stop it                                                              |
| `npm run db:migrate`               | Create and apply a migration after changing `prisma/schema.prisma`   |
| `npm run db:deploy`                | Apply existing migrations (used in CI and production)                |
| `npm run db:generate`              | Regenerate the Prisma client                                         |
| `npm run admin:promote -- <email>` | Grant the admin role (`--revoke` removes it)                         |

## Environment variables

All variables are validated at startup by [src/lib/env.ts](src/lib/env.ts); a bad value stops the app with a message naming the variable. See [.env.example](.env.example) for the full list.

### Payment modes

| `PAYMENTS_MODE` | Meaning                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `mock`          | No provider. Used by automated tests and CI                                       |
| `test`          | Razorpay test keys (`rzp_test_...`). No real money moves                          |
| `live`          | Razorpay live keys. Refused unless `LIVE_SETTLEMENT_APPROVED=true` (see ADR 0003) |

Real payments are intentionally disabled until a provider-approved settlement model exists.

### Google sign-in

The "Continue with Google" button appears only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. Open **APIs & Services → OAuth consent screen**. Choose **External**, fill in the app name (ShaadiFund), support email and developer email. Scopes: `openid`, `email`, `profile` only.
3. While the app is in **Testing**, only the Google accounts you add under **Test users** can sign in. Publish the app before launch.
4. Open **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorised JavaScript origins: `http://localhost:3000` (and later your real domain).
   - Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google` (and later `https://<your-domain>/api/auth/callback/google`).
5. Copy the client ID and secret into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart `npm run dev`.

Someone who first signed in with an emailed link and later chooses Google with the same address lands in the same account. Linking happens only for accounts whose email was already verified, so nobody can claim another person's account by registering their address first.

### Razorpay test mode

Set `PAYMENTS_MODE=test` with your `rzp_test_` keys. The gift form then opens Razorpay's own checkout window with a "Test Mode" ribbon; no real money moves. In that window choose Netbanking, pick any bank and press **Success** (or **Failure**) on Razorpay's test page.

Razorpay cannot reach `localhost`, so webhooks do not arrive during local development. The app does not depend on them: the browser's result is verified with Razorpay directly, and the scheduled housekeeping job recovers any payment that was never reported back.

To receive webhooks on a deployed site:

1. In the Razorpay dashboard (Test mode) open Account & Settings, Webhooks, and add `https://<your-domain>/api/webhooks/razorpay`.
2. Choose a secret, and select the events `payment.captured` and `payment.failed`.
3. Put the same secret in `RAZORPAY_WEBHOOK_SECRET`. Without it every delivery is refused.

### Admin console

The admin console is at `/admin`. Anyone who is not an admin sees the ordinary "not found" page there. There is deliberately no screen or API for granting the role; it needs database access:

```bash
npm run admin:promote -- person@example.com
```

The person must have signed in once first. Add `--revoke` to remove the role. Access is checked against the database on every admin request, so a revoked admin loses access immediately.

### Early-access waitlist

While `SIGNUPS_OPEN` is unset or `false`, the home page asks visitors to join the early-access list instead of creating a wishlist. Sign-in at `/sign-in` keeps working for anyone with the link. Set `SIGNUPS_OPEN=true` (and redeploy) to switch the home page back to sign-ups.

Add `?ref=<tag>` to links you share (for example `https://shaadi-fund.vercel.app/?ref=instagram`) to see where sign-ups came from. Admins see the list at `/admin/waitlist` and can download it as a spreadsheet.

No confirmation email is sent yet: until a sending domain is verified in Resend, it could only reach the founder.

### Scheduled housekeeping

`/api/internal/cron/housekeeping` recovers unreported payments, closes abandoned checkouts, checks every dream's total against its captured payments and retries queued email. Call it every few minutes with the header `Authorization: Bearer <CRON_SECRET>`. It answers 404 until `CRON_SECRET` is set.

### Secrets

- Secrets live only in `.env.local` (git-ignored) and in the hosting provider's environment settings. Never commit them and never put them in a `NEXT_PUBLIC_` variable.
- To rotate a Razorpay key: generate a new key in the Razorpay dashboard, update the environment variable, redeploy, confirm `/api/health` and a test payment, then delete the old key in the dashboard. Rotate the webhook secret the same way, from the webhook's settings.
- Rotate immediately if a key is ever pasted into chat, a ticket, a screenshot or a commit.

## Project layout

```
src/app          routes (pages and API)
src/modules      business modules: schema, service, repository
src/components   UI primitives and wedding themes
src/lib          env, database client, errors, HTTP helpers, logging, money
prisma           schema and migrations
tests            integration and end-to-end tests
docs             decision records and API contracts
```

Rules enforced by lint: only `*.repository.ts` files and `src/lib/db.ts` import Prisma; components never import the database or a repository; no `any`.
