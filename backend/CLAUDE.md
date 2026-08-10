# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Backend of the iReports monorepo. See the [root CLAUDE.md](../CLAUDE.md) for the overall
product/architecture picture. This file covers backend-specific commands and conventions.

## Commands

Run from `backend/`.

All tooling config files (`tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`,
`.prettierrc`, `prisma.config.ts`) live under `src/config/`, not at the `backend/` root — the npm
scripts below already point at them via the relevant `-c`/`-p`/`--config` flags. Pass the same flag
if you invoke `nest`/`eslint`/`prettier`/`tsc-alias`/`prisma` directly instead of through `npm run`.

```bash
npm run start:dev          # nest start --watch + tsc-alias watcher (path aliases resolved on the fly)
npm run build               # nest build -c src/config/nest-cli.json && tsc-alias -p src/config/tsconfig.build.json
npm run start:prod          # node dist/main (requires build first)
npm run lint                 # eslint --config src/config/eslint.config.mjs --fix over src/apps/libs/test
npm run format                # prettier --config src/config/.prettierrc --write src/**/*.ts test/**/*.ts

npm run test                    # jest, all *.spec.ts under src
npm run test -- deals.service    # jest, filter by filename/testname pattern
npm run test -- --testPathPattern=domains/service/modules/sales
npm run test:watch
npm run test:cov
npm run test:e2e                # separate jest config: test/jest-e2e.json
```

Prisma (schema lives in `prisma/schema/*.prisma`, config in `src/config/prisma.config.ts`):

```bash
npx prisma generate --config src/config/prisma.config.ts             # regenerate client into prisma/generated/prisma/schema
npx prisma migrate dev --config src/config/prisma.config.ts --name x  # create+apply a migration (prisma/migrations)
npx prisma studio --config src/config/prisma.config.ts
```

One-off scripts (build first, they run from `dist/`):

```bash
npm run initial                  # nest build -c src/config/nest-cli.json && node dist/src/shared/initialUploadData.js
npm run price:monitoring         # nest build -c src/config/nest-cli.json && node dist/src/utils/runPriceMonitoring.js
npm run export:roapp-orders      # nest build -c src/config/nest-cli.json && node dist/src/shared/exportRoappOrders.js
```

To run a single test file directly with ts-jest, `cd backend` and use the `test` script with a path/name
filter (jest's `rootDir` is `src`, so paths are relative to `src/`) — see above.

## Architecture

The backend is **mid-refactor** from a flat NestJS app into a DDD/domain-oriented structure. Three
generations of code coexist in `src/`:

- `src/domains/{opt,service,shop}` — the target structure, organized by business domain (see root
  CLAUDE.md for what each domain means). This is where new features go. `service` and `shop` each
  have their own CLAUDE.md with domain-specific detail:
  [`domains/service/CLAUDE.md`](./src/domains/service/CLAUDE.md),
  [`domains/shop/CLAUDE.md`](./src/domains/shop/CLAUDE.md). `opt` is an empty placeholder directory.
- `src/TODO/` — modules (`deals`, `reports`, `priceMonitoring`) carried over as-is from the old
  structure, still wired into `AppModule`, **pending refactor into a domain**. Don't treat their
  layout as a pattern to copy.
- `backend/deprecated/` — the previous, pre-refactor backend. It is *not* compiled into the app
  (excluded in `tsconfig.json`) and is kept only as a reference during the migration. Do not import
  from it.

`src/app.module.ts` documents the current migration state in comments (`TODO: временно перенесены...`,
`TODO: не мигрировано...`) — check it before assuming a module has (or hasn't) been ported.

### Layering inside a domain module (the target pattern)

Look at `src/domains/service/modules/accounting` or `.../sales` as the canonical examples of the
layering every new/refactored module should follow:

```
<module>/
├── domain/            — entities, value objects, domain events, domain exceptions, ports (interfaces)
│   ├── entities/
│   ├── value-objects/
│   ├── events/ (or *.events.ts)
│   └── ports/ (repository interfaces)
├── application/        — use cases: CQRS commands + handlers (@nestjs/cqrs), application-level
│   │                      event handlers, application ports
│   ├── command/
│   ├── events/
│   └── ports/
├── infrastructure/     — implementations of domain/application ports: Prisma repositories, mappers,
│   │                      zod schemas for persistence
│   ├── repositories/
│   ├── mappers/
│   └── schemas/
└── interface/ (or api/) — HTTP layer: controllers, request DTOs (nestjs-zod), route constants
    ├── http-controllers/
    └── dto/
```

Dependency direction: `interface` → `application` → `domain`; `infrastructure` implements `domain`/
`application` ports and is wired up in the module's `*.module.ts` via DI tokens (see
`src/shared/application/ports/unit-of-work.port.ts` + `UNIT_OF_WORK` for the pattern). `domain` never
imports from `application`/`infrastructure`/`interface`.

Shared DDD building blocks (base classes to extend, not reimplement) live in `src/shared/domain/`:
`aggregate-root.base.ts`, `entity.base.ts`, `value-object.base.ts`, `domain-event.base.ts`,
`command.base.ts`, `repository.port.ts`, `mapper.interface.ts`.

Cross-cutting request context (`AsyncLocalStorage`-based) lives in
`src/shared/application/context/` (`AppRequestContext`, `ContextInterceptor`) and is populated by
`RequestContextMiddleware`, which must run before any other middleware — see the ordering comment in
`app.module.ts`.

### Data access

- **Prisma** is the ORM; the schema is split across `prisma/schema/*.prisma` (one file per domain area:
  `schema.prisma`, `bitrix.prisma`, `roapp.prisma`, `moySklad.prisma`, `salary.prisma`) and generates
  into `prisma/generated/prisma/schema`.
- Repositories go through a **unit-of-work** abstraction (`UNIT_OF_WORK` token, provided by
  `DatabaseModule`, implemented by `PrismaUnitOfWork`) rather than injecting `PrismaClient` directly
  in domain repositories where transactional consistency across aggregates matters.
- Path alias `@/*` → `src/*` (configured in `tsconfig.json` and mirrored in jest's
  `moduleNameMapper`).

### Contracts

Request/response shapes shared with the frontend come from the `ireports-contracts` workspace
package (`../contracts`), validated via `nestjs-zod`. When an endpoint's payload shape needs to
change, update the schema in `contracts/` first — both backend and frontend consume it from there.

### Integrations

External systems live under `src/integrations/` (Bitrix24, AI/OpenAI-compatible, Google Sheets) and
`src/domains/{service,shop}/integrations/` for domain-specific ones (RoApp/REM Online for `service`,
МойСклад for `shop`). Each domain also has a `sync/` folder (`src/domains/service/sync`,
`src/domains/shop/sync`, `src/sync/bitrix`) with scheduled/cron jobs (`@nestjs/schedule`,
`src/shared/cron/prod-cron.decorator.ts`) that pull data from the ERP into the local database.

### Errors

Domain-level exceptions extend the base in `src/shared/exceptions/exception.base.ts` with codes from
`exception.codes.ts`; `DomainExceptionFilter` (`src/shared/exceptions/domain-exception.filter.ts`)
maps them to HTTP responses.

### Endpoints

See [`../ENDPOINTS.md`](../ENDPOINTS.md) for the current list of routes (no global prefix is set).