# Kasir UMKM

A mobile-first point-of-sale app for Indonesian small businesses. Built with Next.js, TypeScript, Tailwind CSS, and Supabase; designed for Vercel.

## Current milestone

Current implementation includes Supabase authentication and onboarding, tenant-scoped product/category management, POS checkout with database-side stock validation and idempotency, transaction receipts/history, expense tracking, dashboard, and monthly reports. The additive `202610220004_kasir_schema_and_voids.sql` migration aligns fresh installs with the `kasir_*` tables and adds audited stock movements and owner-only transaction cancellation. Review and apply migrations deliberately to the intended non-production project before using these features.

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

## Vercel

Import this repository into Vercel and configure the two environment variable names above separately for Development, Preview, and Production. Use a development/staging Supabase project for Preview. Production deployment requires explicit owner approval and is not part of routine code changes.

## Security notes

- Tenant isolation must be enforced by PostgreSQL Row Level Security, not UI filtering alone.
- Financial writes must be server-validated and atomic.
- Do not report a sale as successful until the database confirms persistence.
- Production database migrations must be reviewed and applied deliberately, never as an incidental build step.
