# ADR 0002: Authentication with Better Auth, magic link and Google

**Status:** Accepted and implemented (2026-11-15) with Better Auth 1.7. Magic link is verified end to end; Google sign-in is wired but untested because no Google credentials exist yet.

## Context

Couples and admins need accounts. Guests must never need one. Storing passwords adds risk and friction for a product each couple uses once.

## Decision

- **Library:** Better Auth with its Prisma adapter and database-backed sessions in httpOnly, secure, SameSite=Lax cookies.
- **Sign-in methods:** email magic link (sent through Resend) and Google OAuth. No local passwords.
- **Roles:** `User.role` is `COUPLE` or `ADMIN`. Admins are promoted only by a seed script or a direct database change, never through any API.
- **Authorization:** enforced in the service layer. Every couple-scoped service function takes the acting user and checks membership of the owning couple. Admin services check the role again on the server, independent of any UI or middleware check.
- **Guests:** identified only by the unguessable `acknowledgmentToken` on their contribution.

## Alternatives considered

- **Auth.js:** now in maintenance; new projects are pointed to Better Auth.
- **Clerk or another hosted service:** fastest, but adds per-user cost and moves user data outside our database.
- **Phone OTP:** the Indian norm, but needs DLT registration and per-message cost. Postponed.

## Consequences

- Magic links depend on email deliverability, so the sending domain needs SPF, DKIM and DMARC before launch.
- Session lookups hit Postgres on authenticated requests. Public wedding pages are unauthenticated and cached, so this does not affect guest traffic.
