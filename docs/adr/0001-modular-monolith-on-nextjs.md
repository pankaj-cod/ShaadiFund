# ADR 0001: Modular monolith on Next.js

**Status:** Accepted (2026-11-15)

## Context

One founder, one coding agent, a product that must reach a working end-to-end MVP quickly and still scale to many wedding pages and bursts of concurrent guests.

## Decision

A single Next.js (App Router) application in strict TypeScript, deployed to Vercel, organised as business modules under `src/modules/<name>` with three layers each:

- `*.schema.ts`: Zod input and output schemas.
- `*.service.ts`: business rules, authorization, transactions.
- `*.repository.ts`: the only code that touches Prisma.

Route handlers and server actions do three things only: parse input, call one service function, map the result to a response. React components never import a repository.

A module may call another module's service, never its repository. This is enforced with an ESLint import-boundary rule.

## Consequences

- One deploy, one database, no network hops between modules.
- The app tier is stateless, so it scales horizontally on Vercel without work from us.
- If a module ever needs to be extracted (most likely `payment`), its service interface is already the seam.
- We accept Vercel's serverless limits: no long-running workers (see ADR 0005) and a connection pooler in front of Postgres.
