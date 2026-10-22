# Architecture

Kasir UMKM is a modular monolith. Next.js route files compose feature modules; business rules live in feature services, and Supabase queries live in feature repositories.

## Structure

```text
src/
  app/                 Next.js routes, metadata, and route-level composition
  modules/<feature>/   Feature-owned components, actions, services, schemas, and repositories
  shared/
    config/            Validated environment and application configuration
    lib/               Small framework-neutral helpers
    supabase/          Browser and server Supabase client factories
    ui/                Shared shadcn/ui components
```

Feature modules should contain `components/`, `actions.ts`, `service.ts`, `repository.ts`, `schemas.ts`, `types.ts`, and `index.ts` as needed. Keep route files thin and export only supported feature APIs from `index.ts`.

## Module boundaries

- A module may import another module only through `@/modules/<feature>`.
- Do not import another feature's components, actions, services, repositories, schemas, or types directly.
- Keep business rules in `service.ts` and keep Supabase calls in `repository.ts`.
- Server Actions validate input, call the feature service, and return a serializable result. They do not contain business rules or database queries.
- Shared code must be small and framework-neutral. Feature-specific code stays inside its module.
- Avoid circular module dependencies. If two modules need the same primitive, move that primitive to `src/shared`.

## Adding a feature module

1. Create `src/modules/<feature>/` and add only the files the feature needs.
2. Define input and output types in `types.ts` and validate external input in `schemas.ts` with Zod.
3. Put tenant-aware Supabase queries in `repository.ts`; use the authenticated user's business context and rely on RLS as a second boundary.
4. Put decisions and calculations in `service.ts`, with repositories passed as ordinary function arguments when needed.
5. Keep Server Actions thin and export the module's supported API through `index.ts`.
6. Compose the module from `src/app` and import other modules only through their public entry points.

## Migration note

The existing routes are being moved into this structure in small feature steps. Until each feature is migrated, its current route and legacy `src/lib/supabase` imports remain compatibility code. New feature code must follow the module boundaries above.
