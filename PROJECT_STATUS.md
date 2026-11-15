# VowFund project status

_Last updated: 2026-11-15_

## Current phase

**Slice 2: guest contribution with a mock payment.** Built and verified; awaiting founder review before slice 3 (Razorpay test mode).

## Completed

- **Phase 0, product discovery:** delivered in conversation. Founder direction: build a working, deployable product now; register an LLP or company with GST later.
- **Phase 1, architecture:** [ARCHITECTURE.md](ARCHITECTURE.md), six records in [docs/adr](docs/adr), [docs/API.md](docs/API.md), [prisma/schema.prisma](prisma/schema.prisma).
- **Phase 2, foundation:** Next.js 16, strict TypeScript, Tailwind 4, shadcn/ui, Prisma 7 on Postgres, lint layering rules, environment validation with the live-payments gate, design system and three themes, test harness, CI workflow.
- **Slice 1, couple journey:** sign-in by emailed link, onboarding steps 2 to 8 with saved progress, dashboard (share link, publish, dreams, settings), public wedding page, safe photo upload, ownership checks, audit log.
- **Slice 2, guest contribution:**
  - Checkout page per dream: suggested and custom amounts, name, email, optional message (public or private), anonymous option, consent, and a summary showing dream, gift, platform fee, total, beneficiary and refund and support information.
  - Payment provider interface with a mock provider. No money moves; every screen and email says "Demo mode".
  - Server-side order creation; the amount, fee and total are always computed on the server.
  - Verification: signed browser callback, then the provider is asked for the payment's real status and amount. Signed webhooks are stored first, deduplicated and processed through the same code.
  - One capture function, run in a single database transaction with a row lock, is the only place a gift is counted. It adds the gift (never the fee) to the dream.
  - Payment state machine with a full transition history per payment.
  - Email outbox: the guest's receipt and the couple's notification are queued in the capture transaction and sent with retries.
  - Guest acknowledgment page at a private link; failed and expired checkouts explain what happened and offer a retry.
  - Public page shows recent gifts, honouring anonymity, private messages and the couple's privacy settings.
  - Scheduled housekeeping route for email retries and closing abandoned checkouts.

## Verified on 2026-11-15

| Check                                     | Result                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run lint`, `typecheck`, formatting   | Pass                                                                                           |
| `npm test`                                | 129 of 129 pass (unit, plus services against the real database)                                |
| `npm run test:e2e`                        | 14 of 14 pass on phone and desktop sizes, against a production build, twice in a row           |
| Guest journey in a browser                | Validation, failed payment, successful payment, anonymous gift, private message, receipt email |
| Duplicate webhooks                        | Counted once                                                                                   |
| Invalid or mismatched signatures          | Rejected; nothing stored or counted                                                            |
| Payment captured for a different amount   | Refused; nothing counted; event kept as failed                                                 |
| Callback and webhooks racing (12 at once) | Counted once                                                                                   |
| Ten guests paying one dream at once       | Total exact to the paisa                                                                       |
| Repeated checkout submissions (6 at once) | One contribution, one order                                                                    |
| Stored totals against captured payments   | Equal for every dream                                                                          |
| A stranger editing another couple's data  | Refused                                                                                        |
| Screens reviewed by eye                   | Checkout, demo payment, acknowledgment, public page with gifts                                 |
| Development server (`npm run dev`)        | **Not verified.** All browser checks ran against a production build                            |
| Scheduled housekeeping route              | **Not exercised over HTTP.** Its two functions are tested directly                             |
| Google sign-in, real email through Resend | **Not tested.** No credentials                                                                 |
| GitHub Actions workflow                   | **Not run.** No GitHub remote                                                                  |

## Pending

1. **Slice 3, Razorpay test mode:** Razorpay provider behind the existing interface, hosted checkout, webhook endpoint, refunds, reconciliation of stale payments, Content Security Policy.
2. **Slice 4:** contributions and messages in the dashboard, thank-you notes, message moderation, admin console, landing page, legal pages, analytics events.
3. **QA, then deployment.**

## Working assumptions (founder can overrule)

| Topic           | Assumption                                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name            | VowFund (the folder is named ShaadiFund)                                                                                                                             |
| Fee model       | Guest pays a transparent fee on top of the gift; nothing is deducted from the gift. **2.5% is now shown at checkout** but is still a placeholder awaiting a decision |
| Overfunding     | Allowed; the progress bar caps at 100%                                                                                                                               |
| Anonymous gifts | Hidden from other guests, visible to the couple                                                                                                                      |
| Refunds         | Gifts are final except failed or duplicate charges                                                                                                                   |
| Limits          | Contribution ₹100 to ₹5,00,000; dream target up to ₹1,00,00,000                                                                                                      |

## Blocked on things outside the code

- **Real payments.** Need a registered entity with GST and a current account, then Razorpay's written approval of Route for this use case. Until then production runs in Razorpay test mode with a visible demo notice.
- **Legal review.** Tax treatment of gifts and fees, DPDP consent and notices, refund policy, terms. Nothing here claims compliance.

## Known bugs

- **A development server started before new screens were added may return 404 for them.** Restarting `npm run dev` is expected to fix it; not confirmed.
- **Not-found wedding pages return HTTP 200, not 404.** The content is correct and carries no couple data, but the status is wrong because the page streams. To fix before launch.
- Removing a cover photo in the dream form or settings does not delete the stored file.
- Prisma's driver logs a deprecation warning ("client.query() when the client is already executing a query") during transactions. It comes from inside Prisma 7's Postgres adapter, not from application code, and will need a Prisma upgrade before `pg` 9.

## Technical debt and risks

- **Photo storage is local disk only.** It works in development and tests but not on serverless hosting. An object-storage driver (Cloudinary or S3) behind the existing interface is required before deployment.
- **Rate limiting is in-memory.** Correct for one process; production needs a shared store (ADR 0005). Sign-in uses the auth library's own limiter, which is also in-memory.
- **`PAYMENTS_MODE=test` does not work yet.** The Razorpay provider arrives in slice 3, so `.env.local` was switched to `mock`. The Razorpay test keys are still stored there.
- **No scheduler is configured.** The housekeeping route exists, but nothing calls it until deployment sets up a cron and `CRON_SECRET`. Emails are still sent right after each payment.
- **The fee rate, limits and suggested amounts are constants in code**, not yet editable by an admin.
- **Guests' messages are stored when checkout starts**, and shown only once the payment is confirmed. Messages from abandoned checkouts stay in the database until a retention job exists.
- Refunds are modelled in the schema and state machine but no refund flow is built.
- Framer Motion is not installed; transitions are plain CSS so far.
- Prisma 8 is at release-candidate stage; we are on the stable 7 line and plan one upgrade.
- No Content Security Policy yet. It is added with checkout, when the payment provider's origins are fixed.
- Sentry and Upstash are not installed yet.
- npm reported install scripts for `prisma`, `@prisma/engines`, `esbuild` and `sharp` as not yet approved; they should be reviewed and approved with `npm install-scripts approve`.
- Nothing is committed to git yet.

## Next actions

1. Founder restarts `npm run dev` and tries a gift (README, "Trying a gift locally").
2. Founder decides the fee model: who pays, and how much.
3. On approval, start slice 3 (Razorpay test mode). It needs a webhook secret created in the Razorpay dashboard.
4. Founder, in parallel: ask Razorpay about Route eligibility for wedding gifting; create a GitHub repository so CI can run.

## Deployment status

Not deployed. Local only. No hosting, database or email accounts created.
