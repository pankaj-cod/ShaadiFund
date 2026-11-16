# ShaadiFund project status

_Last updated: 2026-11-16_

## Current phase

**Slice 4a: the couple's gifts page, analytics and the admin console.** Built and verified with the mock payment provider. Still open from slice 3: **a complete Razorpay test payment has not been confirmed by hand.**

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

- **Slice 3, Razorpay test mode:**
  - Razorpay provider behind the same interface as the mock: orders with automatic capture, checkout signature check, webhook signature check, payment lookup, capture, refund.
  - Razorpay's hosted checkout opens from the gift form. Card, UPI and bank details are entered in Razorpay's window and never reach this app.
  - Webhook endpoint at `/api/webhooks/razorpay`, deduplicated on Razorpay's delivery id. Refused entirely unless a webhook secret is configured.
  - Reconciliation: payments we never heard back about are looked up at Razorpay and counted if they were paid.
  - A check that every dream's stored total equals the sum of its captured gifts.
  - Full refunds as a service function: returns the money, takes the gift out of the dream, and cannot run twice. No screen calls it yet.
  - Content Security Policy allowing only this site and Razorpay.

- **Slice 4a, gifts, analytics and admin:**
  - Couple's "Gifts and messages" page: every paid gift with the guest's name, email, amount, dream and message, including anonymous and private ones; totals received.
  - Thank-you notes: saved per gift, emailed to the guest once, shown on the guest's private page, editable later without a second email.
  - Message moderation: the couple can hide a public message from their page and show it again.
  - Analytics: eleven product events recorded on the server, plus a page-view beacon that accepts only two event names. Visitors are counted by a daily-rotating hash; no IP address or browser string is stored.
  - Admin console at `/admin`: overview metrics (couples, published weddings, guests, contributions, volume, fees, checkout conversion, payment success rate, popular categories) with a demo/live filter; couples with suspend and restore; payments with full status history, webhook events and refunds; a refund button that needs a written reason; webhook event log; audit log.
  - Admin role is checked against the database inside every admin function. Non-admins see "not found". The role is granted only by `npm run admin:promote`.

- **Visual redesign (warm and cinematic), using free Aceternity UI components restyled to the ivory, charcoal and gold palette:**
  - Components adopted: resizable navbar, aurora background, flip words, text generate effect, timeline, wobble cards, bento grid, infinite moving cards, and a tilt card based on their 3D card. Three were rewritten to meet this project's strict type and lint rules; an external logo image and a missing texture file were removed.
  - New landing page: hero with rotating dreams, how it works, couple and guest use cases, example wishlist, clearly labelled sample testimonials, fee explanation, common questions, closing call to action, footer.
  - Demo wedding at `/demo` with invented content and no contribute buttons.
  - Draft legal pages at `/legal/privacy`, `/legal/terms`, `/legal/refunds`, `/legal/fees` and `/legal/contact`, each marked as an unreviewed draft.
  - Wedding page: reveal animations, tilting dream cards, category artwork where a dream has no photo. Gift page: word-by-word thank-you heading. Sign-in and onboarding: soft glow and page-rise animation. Buttons: gentle lift on hover.

## Verified on 2026-11-16

| Check                                                       | Result                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run lint`, `typecheck`, formatting                     | Pass                                                                                     |
| `npm test`                                                  | 176 of 176 pass                                                                          |
| `npm run test:e2e` (mock payments)                          | 14 of 14 pass on phone and desktop sizes, against a production build                     |
| Razorpay test API with the real keys                        | Orders are created; unknown payments and a wrong secret are reported as errors           |
| Razorpay checkout opening from the gift form                | Opens in Test Mode showing the correct total (₹1,127.50 for a ₹1,100 gift)               |
| **Completing a Razorpay test payment**                      | **Not verified.** Razorpay's window did not accept automated input; needs a manual run   |
| Razorpay signature checks                                   | Unit tested against Razorpay's documented formulas, not against a real signed payment    |
| Razorpay webhooks                                           | Unit tested with simulated signed events. No real delivery: no public URL, no secret set |
| Refund and capture calls to Razorpay                        | Request shape unit tested only; never run against Razorpay                               |
| Duplicate webhooks, forged signatures, wrong amounts, races | Counted once or rejected (mock provider)                                                 |
| Reconciliation                                              | Recovers paid gifts, ignores unpaid, failed, fresh and wrong-amount ones (mock provider) |
| Refunds                                                     | Totals reduced once even with five simultaneous requests (mock provider)                 |
| Content Security Policy                                     | No violations from this app or Razorpay's checkout in a production build                 |
| Development server (`npm run dev`)                          | Not re-verified since slice 2                                                            |
| Google sign-in, real email through Resend                   | **Not tested.** No credentials                                                           |
| Couple's gifts page, thank-you note, hiding a message       | Pass in the browser test, including the guest seeing the note and getting the email      |
| Admin access by a non-admin                                 | "Not found" in the browser; every admin function refuses in service tests                |
| Admin refund from the console                               | Pass in the browser test with the mock provider; totals drop on the public page          |
| Admin and gifts screens reviewed by eye                     | **Not done**                                                                             |
| GitHub Actions workflow                                     | Result unknown; not checked from here                                                    |

## Pending

1. **Confirm a Razorpay test payment by hand**, then set up the webhook once the site has a public URL.
2. **Slice 4b:** full landing page (hero, how it works, example wishlist, sample testimonials, FAQ, fees), legal pages as clearly marked drafts (privacy, terms, refunds, payment and fee disclosure, contact), "report this page" and support forms with their admin queues, admin-editable platform settings, a seeded demo wedding, account deletion request.
3. **QA, then deployment.**

## Working assumptions (founder can overrule)

| Topic           | Assumption                                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name            | ShaadiFund (renamed from the working name VowFund on 2026-11-16)                                                                                                     |
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

- **The local database, its user and its Docker volume are still called `vowfund`.** These are internal names nobody sees; renaming them would wipe local data, so they were left. Production will use its own names.
- **`shaadifund.in` is assumed as the domain** for the support address and example links. Confirm the real domain before launch.

- **No photography.** The redesign uses drawn category artwork; real photos (the couple's own, and licensed images for the landing page) would lift it far more than any effect.
- **Dashboard, gifts page, settings and admin console keep their earlier layout**; they inherit the new buttons, header and animation but were not redesigned.
- **The legal pages are my plain-language drafts**, not lawyer-reviewed policies, and `support@shaadifund.in` appears throughout but may not exist yet.
- The landing page states the 2.5% guest fee, which is still an undecided placeholder.
- Aceternity's paid "all-access" blocks were not used.

- **Admin and gifts screens were checked by automated browser tests, not reviewed by eye.**
- **A failed webhook event cannot be reprocessed from the admin console.** The provider's own retries and the reconciliation job cover it.
- **Admin lists have no search.** Fine for a pilot; needed before volume grows.
- **Admins can see every guest's name and email.** Expected for support, but the admin list should stay very short, and admin sign-in should get a second factor before launch.
- Reports and support requests have database tables but no forms or admin queues yet (slice 4b).

- **Photo storage is local disk only.** It works in development and tests but not on serverless hosting. An object-storage driver (Cloudinary or S3) behind the existing interface is required before deployment.
- **Rate limiting is in-memory.** Correct for one process; production needs a shared store (ADR 0005). Sign-in uses the auth library's own limiter, which is also in-memory.
- **`.env.local` is back on `PAYMENTS_MODE=test`**, so the local site uses Razorpay's test checkout. Automated tests always force the mock provider.
- **Razorpay asks the guest for a mobile number** in its own window. This app does not collect or store it.
- **The Content Security Policy allows inline scripts**, because Next.js streams page data that way and a stricter nonce-based policy would disable page caching.
- Partial refunds are not supported; only full refunds.
- **No scheduler is configured.** The housekeeping route exists, but nothing calls it until deployment sets up a cron and `CRON_SECRET`. Emails are still sent right after each payment.
- **The fee rate, limits and suggested amounts are constants in code**, not yet editable by an admin.
- **Guests' messages are stored when checkout starts**, and shown only once the payment is confirmed. Messages from abandoned checkouts stay in the database until a retention job exists.
- Framer Motion is not installed; transitions are plain CSS so far.
- Prisma 8 is at release-candidate stage; we are on the stable 7 line and plan one upgrade.
- Sentry and Upstash are not installed yet.
- npm reported install scripts for `prisma`, `@prisma/engines`, `esbuild` and `sharp` as not yet approved; they should be reviewed and approved with `npm install-scripts approve`.
- Nothing is committed to git yet.

## Next actions

1. **Founder makes one Razorpay test payment** (README, "Razorpay test mode") and reports the result.
2. Founder signs in, runs `npm run admin:promote -- <their email>`, and looks over `/admin` and `/dashboard/gifts`.
3. Founder decides the fee model: who pays, and how much.
4. On approval, start slice 4b.

## Deployment status

Not deployed. Local only. No hosting, database or email accounts created.
