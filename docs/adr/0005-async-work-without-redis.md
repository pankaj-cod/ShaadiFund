# ADR 0005: Background work with a Postgres outbox and scheduled jobs

**Status:** Accepted (2026-11-15). Revisit when email volume or job variety grows.

## Context

The original brief lists Redis and BullMQ. BullMQ needs a long-running worker process, which Vercel does not provide. The MVP has three kinds of background work: sending email, reconciling payments, expiring abandoned checkouts.

## Decision

- **Outbox:** the `Notification` table. Rows are inserted in the same transaction as the business change, so an email is queued if and only if the change committed. `dedupeKey` prevents double sends.
- **Dispatch:** after commit, the request tries to send immediately using Next.js `after()`. A scheduled job retries anything still `PENDING` or `FAILED`, with backoff, up to five attempts. Rows are claimed with `FOR UPDATE SKIP LOCKED` so parallel runs never send twice.
- **Schedules:** Vercel Cron calls authenticated internal routes (`/api/internal/cron/*`, protected by `CRON_SECRET`) for notification dispatch, payment reconciliation and counter reconciliation.
- **Rate limiting:** Upstash Redis over HTTP, used only for rate limits on auth, checkout, message and upload endpoints. In local development and tests an in-memory limiter is used.

## Consequences

- No worker fleet to run or pay for, and no lost jobs on deploy.
- Throughput is bounded by cron frequency. This is ample for transactional email at pilot scale.
- Moving to BullMQ or a hosted queue later means replacing the dispatcher only; the outbox table and its callers stay.
