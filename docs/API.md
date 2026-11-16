# ShaadiFund API contracts

Phase 1 contract. Request and response bodies are defined precisely by the Zod schemas in each module once built; this file is the agreed surface.

## Conventions

- Base path `/api`. JSON in and out.
- Success: `{ "data": ... }`. Failure: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "amountPaise": "..." } } }`.
- Error codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `PAYMENT_ERROR` 402, `INTERNAL` 500.
- Money is always integer paise in fields ending `Paise`.
- Lists use keyset pagination: `?limit=20&cursor=<opaque>`, returning `{ "data": [...], "nextCursor": "..." | null }`.
- Auth column: **Public** (no session), **Couple** (session and membership of the owning couple), **Admin** (session with admin role), **Signature** (provider HMAC), **Cron** (`CRON_SECRET` bearer).

## Public: wedding and guest

| Method and path                         | Auth                 | Purpose                                                                                            |
| --------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /weddings/{slug}`                  | Public               | Published wedding, active dreams with totals, visible messages. Honours the couple's privacy flags |
| `GET /weddings/{slug}/dreams/{dreamId}` | Public               | One dream with recent visible contributions                                                        |
| `POST /weddings/{slug}/contributions`   | Public, rate limited | Start checkout                                                                                     |
| `POST /contributions/{id}/verify`       | Public, rate limited | Verify the provider callback                                                                       |
| `GET /contributions/{id}/status?token=` | Public               | Poll status while the server confirms                                                              |
| `GET /gifts/{token}`                    | Public               | Guest acknowledgment: dream, amount, message, the couple's thank-you                               |
| `POST /weddings/{slug}/reports`         | Public, rate limited | Report a page                                                                                      |
| `POST /support`                         | Public, rate limited | Contact support                                                                                    |
| `POST /events`                          | Public, rate limited | Record a product analytics event from an allow-list of names                                       |

### `POST /weddings/{slug}/contributions`

Request:

```json
{
  "dreamId": "uuid",
  "amountPaise": 500000,
  "guestName": "Ananya Rao",
  "guestEmail": "ananya@example.com",
  "isAnonymous": false,
  "message": "Wishing you both a lifetime of adventures.",
  "messageVisibility": "PUBLIC",
  "consent": true,
  "idempotencyKey": "client-generated-uuid"
}
```

Response `201` (or `200` with the same body when the idempotency key was already used):

```json
{
  "data": {
    "contributionId": "uuid",
    "acknowledgmentToken": "base64url",
    "amountPaise": 500000,
    "platformFeePaise": 12500,
    "totalPaise": 512500,
    "payment": {
      "provider": "RAZORPAY",
      "mode": "TEST",
      "orderId": "order_xxx",
      "publicKey": "rzp_test_xxx"
    }
  }
}
```

Rules: the dream must be active, not deleted, and on a published wedding. The amount must be within the configured minimum and maximum. The fee and total are computed on the server. `consent` must be true.

### `POST /contributions/{id}/verify`

Request: `{ "token": "acknowledgmentToken", "providerOrderId": "...", "providerPaymentId": "...", "signature": "..." }`

Response: `{ "data": { "status": "CONFIRMED" | "PENDING" | "FAILED" } }`

`PENDING` means the signature was valid but the provider has not reported capture yet; the client polls the status endpoint.

## Webhooks and internal

| Method and path                          | Auth                                    | Purpose                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /webhooks/razorpay`                | Signature                               | Store, deduplicate and process provider events. `200` once stored and processed or already seen; `400` on a bad signature; `500` on a processing failure so the provider retries |
| `POST /webhooks/mock`                    | Signature, disabled when mode is `live` | Same pipeline for the mock provider                                                                                                                                              |
| `POST /internal/cron/notifications`      | Cron                                    | Send queued email                                                                                                                                                                |
| `POST /internal/cron/reconcile-payments` | Cron                                    | Resolve stale payments, expire abandoned contributions                                                                                                                           |
| `POST /internal/cron/reconcile-totals`   | Cron                                    | Check dream counters against captured payments                                                                                                                                   |

## Couple

All routes act on the signed-in user's own couple. Dashboard forms may call the same services through Server Actions.

| Method and path                                    | Purpose                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET /me`                                          | Current user, couple, onboarding step                                  |
| `PATCH /couple`                                    | Partner names; autosaves onboarding progress                           |
| `GET /wedding`                                     | Own wedding including drafts                                           |
| `PATCH /wedding`                                   | Date, venue, theme, messages, privacy flags                            |
| `GET /wedding/slug-availability?slug=`             | Check a URL                                                            |
| `POST /wedding/publish`, `POST /wedding/unpublish` | Change visibility. Publishing needs names, a slug and one active dream |
| `GET /dreams`, `POST /dreams`                      | List and create                                                        |
| `PATCH /dreams/{id}`, `DELETE /dreams/{id}`        | Edit; delete is a soft delete when contributions exist                 |
| `PUT /dreams/order`                                | Reorder: `{ "ids": ["uuid", ...] }`                                    |
| `POST /media/sign`                                 | Signed upload parameters for a given kind                              |
| `POST /media`                                      | Register a completed upload after server-side checks                   |
| `DELETE /media/{id}`                               | Remove an image                                                        |
| `GET /contributions`                               | Confirmed contributions with guest details, paginated                  |
| `GET /contributions/summary`                       | Totals per dream and overall                                           |
| `GET /messages`                                    | Guest messages, paginated                                              |
| `PATCH /messages/{id}`                             | Hide or show                                                           |
| `PUT /messages/{id}/reply`                         | Send or edit the thank-you note; emails the guest                      |
| `GET /settlements`                                 | Settlement records as reported by the provider                         |
| `POST /account/delete-request`                     | Start the data deletion process                                        |

## Admin

Every route re-checks the admin role on the server and writes an audit entry for any change.

| Method and path                                                          | Purpose                                                                                                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/metrics`                                                     | Couples, published weddings, guests, contributions, volume, conversion, payment success rate, popular categories. Filterable by payment mode |
| `GET /admin/couples`, `GET /admin/couples/{id}`                          | Browse couples                                                                                                                               |
| `POST /admin/weddings/{id}/suspend`, `POST /admin/weddings/{id}/restore` | Take a page down or restore it                                                                                                               |
| `GET /admin/payments`, `GET /admin/payments/{id}`                        | Payments with transition history and events                                                                                                  |
| `POST /admin/payments/{id}/refund`                                       | Issue a refund                                                                                                                               |
| `GET /admin/payment-events`                                              | Webhook log, filterable by status                                                                                                            |
| `POST /admin/payment-events/{id}/reprocess`                              | Re-run a failed event                                                                                                                        |
| `GET /admin/reports`, `PATCH /admin/reports/{id}`                        | Reported content                                                                                                                             |
| `GET /admin/support`, `PATCH /admin/support/{id}`                        | Support requests                                                                                                                             |
| `GET /admin/config`, `PUT /admin/config/{key}`                           | Platform settings                                                                                                                            |
| `GET /admin/audit-logs`                                                  | Audit trail                                                                                                                                  |

## Auth

`/api/auth/*` is served by the auth library: magic link request and callback, Google sign-in, session, sign-out.

## Implementation notes (slice 2)

Built so far from the public and webhook tables above: `POST /weddings/{slug}/contributions`, `POST /contributions/{id}/verify`, `GET /contributions/{id}/status?token=`, `POST /webhooks/mock`, and one scheduled-job route, `/internal/cron/housekeeping`, which both retries queued email and closes abandoned checkouts.

Differences from the original contract:

- Public wedding and gift data are rendered by server components (`/wedding/{slug}`, `/gift/{token}`), so `GET /weddings/{slug}` and `GET /gifts/{token}` do not exist as JSON routes.
- `POST /mock-provider/pay` stands in for the provider's hosted checkout. It and `/webhooks/mock` answer 404 unless `PAYMENTS_MODE=mock`.
- The couple's own changes go through Server Actions, not the REST routes listed under "Couple".
- Not built yet: reports, support, analytics events, settlements, account deletion, every admin route, and the Razorpay webhook.
