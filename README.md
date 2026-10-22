# Kasir UMKM

A mobile-first point-of-sale app for Indonesian small businesses. Built with Next.js, TypeScript, Tailwind CSS, and Supabase; designed for Vercel.

## Current milestone

Current implementation includes tenant-scoped product and category management, shifts, cash movements, atomic checkout with stock validation, discounts and idempotency, receipts, transaction history, expenses, monthly profit reporting, staff invitations, settings, and PWA shell behavior. `202610220006_pos_operations.sql` extends the existing `kasir_*` schema without deleting legacy tables or data. It has not been applied to the connected Supabase project; review and apply migrations deliberately to the intended development project before using the new database features.

## Requirements

- Node.js 20+
- npm
- A Supabase project for non-production development

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using a development Supabase project.
4. Start the app: `npm run dev`

Do not commit `.env.local`. Never expose a Supabase service-role key in browser code. No database migration is run automatically by the app.

## Checks

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Local database and tests

Tenant isolation and shift/checkout behavior are covered by pgTAP in `supabase/tests/rls_tenant_isolation.sql`. With the Supabase CLI and Docker available, run `npx supabase start`, then `npx supabase test db`. The tests use disposable fixtures inside a transaction. `npx supabase db reset` applies local migrations and seeds a demo owner (`demo@kasir-umkm.test`, password `demo-kasir-local-only`) with example products. That password is only for the disposable local stack. Stop it with `npx supabase stop`.

Run the application checks with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Next dev/build use Webpack because Serwist's Next integration currently relies on its Webpack plugin.

For staff invitations, set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment. It is never read by browser code. Sentry is inactive unless `SENTRY_DSN` is configured server-side.

## Vercel

Import this repository into Vercel and configure the two environment variable names above separately for Development, Preview, and Production. Use a development/staging Supabase project for Preview. Production deployment requires explicit owner approval and is not part of routine code changes.

## Security notes

- Tenant isolation must be enforced by PostgreSQL Row Level Security, not UI filtering alone.
- Financial writes must be server-validated and atomic.
- Do not report a sale as successful until the database confirms persistence.
- Production database migrations must be reviewed and applied deliberately, never as an incidental build step.
