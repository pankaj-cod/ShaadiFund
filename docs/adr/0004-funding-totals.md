# ADR 0004: Funding totals as transactional counters with reconciliation

**Status:** Accepted (2026-11-15)

## Context

The displayed total for a dream must never exceed the sum of verified payments. Public wedding pages are the hottest read path, and several guests may pay for the same dream at the same moment.

## Options

1. **Compute `SUM()` on every read.** Always correct, but an aggregate per dream per page view does not scale.
2. **Counters on `Dream`, updated by application code.** Fast, but drifts if any code path forgets.
3. **Counters updated only inside the capture and refund transactions, plus a reconciliation check.** Fast and verifiably correct.

## Decision

Option 3.

- `Dream.fundedPaise` and `Dream.contributionCount` are written by exactly one function, `payment.service.applyCapture`, and its refund counterpart.
- Within one database transaction it:
  1. locks the payment row (`SELECT ... FOR UPDATE`);
  2. returns early if the payment is already `CAPTURED` (idempotency);
  3. sets the payment to `CAPTURED` and the contribution to `CONFIRMED`;
  4. runs `UPDATE dream SET funded_paise = funded_paise + $amount, contribution_count = contribution_count + 1` as an atomic increment, never read-modify-write;
  5. writes the transition row, the audit row and the outbox notifications.
- `fundedPaise` counts the gift amount only, never the platform fee.
- A scheduled reconciliation query compares each counter with the aggregate of captured, unrefunded payments and raises a Sentry alert on any mismatch.
- A database CHECK keeps `funded_paise >= 0`.

## Consequences

- Concurrent contributions cannot lose updates, and duplicate webhooks cannot double count.
- Overfunding is allowed: the amount is real money the guest chose to give. The progress bar caps at 100% and shows the true total.
- Soft-deleting a dream leaves its counters and contributions intact.
