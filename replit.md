# Potocopy QTA

Potocopy QTA is a focused point-of-sale workspace for photocopy, print, finishing, and stationery shops.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server.
- `pnpm --filter @workspace/potocopy-qta run dev` — run the web app.
- `pnpm run typecheck` — full typecheck across all packages.
- `pnpm run build` — typecheck + build all packages.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec.
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only).
- Required env: `DATABASE_URL` — PostgreSQL connection string.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 with Clerk middleware
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval
- Web: React + Vite + Tailwind v4
- Build: esbuild for the API, Vite for the web app

## Where things live

- `artifacts/potocopy-qta` — responsive cashier and owner web app.
- `artifacts/api-server/src/routes/pos.ts` — dashboard, catalog, inventory, transaction, and audit APIs.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract.
- `lib/db/src/schema/index.ts` — PostgreSQL/Drizzle schema.
- `artifacts/potocopy-qta/src/index.css` — application theme and visual tokens.

## Architecture decisions

- OpenAPI is the contract boundary; generated React Query hooks and Zod schemas are used by the web client and server.
- Transactions are append-preserving: cancellation updates status and records the reason rather than deleting the sale.
- Catalog and inventory are separate concepts so services can exist without forcing stock tracking.
- Clerk provides the browser session; server mutations require an authenticated Clerk user.

## Product

- Owner dashboard with revenue, payment mix, activity, and stock signals.
- Counter-first cashier flow with catalog search, cart quantities, payment method, change calculation, and receipt/print actions.
- Transaction history with status filtering, detail view, and cancellation reason capture.
- Inventory and product/service catalog views backed by PostgreSQL seed data.

## User preferences

The product should feel purpose-built for a real photocopy counter, not like a generic admin template.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- Run `pnpm --filter @workspace/db run push` after changing the Drizzle schema in development.
- Frontend API calls use the shared `/api` proxy path and Clerk browser cookies; do not add bearer-token handling to the web client.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.