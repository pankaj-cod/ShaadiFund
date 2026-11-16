# ADR 0003: Payment architecture and money flow

**Status:** Accepted (2026-11-15). Implemented: provider interface, mock and Razorpay providers, state machine, capture, webhooks, reconciliation and full refunds. A complete Razorpay test payment has not yet been confirmed end to end, and live mode remains blocked pending Razorpay's written approval and legal review.

## Context

The founder's short-term goal is a working, deployable product. A registered entity (LLP or company with GST) comes later. Without an entity and Razorpay's approval of a marketplace settlement model, the platform has no lawful way to route guest money to couples.

VowFund must never collect, pool, hold or distribute funds itself. Doing so is payment aggregation, which requires RBI authorisation.

## Decision

### 1. Provider abstraction

`PaymentProvider` interface in `src/modules/payment/providers`:

```ts
interface PaymentProvider {
  readonly name: "MOCK" | "RAZORPAY";
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  verifyCheckoutSignature(input: CheckoutCallback): boolean;
  parseWebhook(rawBody: string, signature: string): ProviderEvent; // throws on bad signature
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment>;
  refund(input: RefundInput): Promise<ProviderRefund>;
}
```

Two implementations: `MockProvider` (used by automated tests and local development) and `RazorpayProvider`.

### 2. Three payment modes, chosen by environment

| `PAYMENTS_MODE` | Provider           | Real money | Where it runs                          |
| --------------- | ------------------ | ---------- | -------------------------------------- |
| `mock`          | Mock               | No         | Tests, local                           |
| `test`          | Razorpay test keys | No         | Staging, and production until approval |
| `live`          | Razorpay live keys | Yes        | Production, only after approval        |

- `live` refuses to start unless `LIVE_SETTLEMENT_APPROVED=true` and live keys are present. Live keys must start with `rzp_live_`, test keys with `rzp_test_`; a mismatch fails at boot.
- In `mock` and `test`, every public page, checkout screen, acknowledgment and email carries a visible "Demo mode: no real money moves" notice. A test payment is never presented as a real one.
- `Payment.mode` is stored on every row, so test and live records can never be confused in reports.

### 3. Payment state machine

```
CREATED ──> AUTHORIZED ──> CAPTURED ──> PARTIALLY_REFUNDED ──> REFUNDED
   │             │             └────────────────────────────────> REFUNDED
   └─────────────┴──> FAILED ──> AUTHORIZED | CAPTURED
```

- A failed attempt is not final: providers let a guest retry inside the same order, so a later success on that order still counts. Captured money never moves back to an unpaid state.
- Transitions are validated by one pure function. Illegal or backward transitions are rejected and logged.
- Every transition writes a `PaymentStatusTransition` row in the same transaction.
- Only the transition into `CAPTURED` confirms the contribution and updates the dream's totals (ADR 0004).

### 4. Confirmation rules

1. Server creates the order with the amount taken from the server-side contribution row, never from the client.
2. The client callback is verified by HMAC, then the payment is fetched from the provider to confirm status and amount. The callback can move a payment to `CAPTURED` only if the provider itself reports it captured for the exact amount.
3. Webhooks are verified against the raw body, stored in `PaymentEvent` first, deduplicated on `(provider, providerEventId)`, then processed. Reprocessing a stored event is a no-op.
4. A reconciliation job fetches payments still `CREATED` or `AUTHORIZED` after 15 minutes and resolves them, and expires abandoned contributions.

### 5. Target live model (later, with entity)

Razorpay Route: each couple is a KYC-verified linked account and Razorpay settles gifts to them directly. `SettlementRecord` mirrors what Razorpay reports. This is built only after approval.

## Rejected for now

- **Wallet, escrow, pooled account, withdrawals:** regulated activity.
- **Direct UPI link to the couple's VPA:** lawful person-to-person transfer and needs no entity, but the server cannot verify payment. It could work as a pilot with the couple confirming each gift by hand. Not built; the provider interface leaves room for it as a founder decision.

## Consequences

- The whole product can be deployed and demonstrated publicly now, with no real money.
- Going live is a configuration change plus the Route onboarding work, not a rewrite.
- Refunds after settlement need a transfer reversal under Route. Policy: gifts are final except failed or duplicate charges.
