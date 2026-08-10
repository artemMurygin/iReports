# CLAUDE.md

Guidance for this specific directory. See the [backend CLAUDE.md](../../CLAUDE.md) for the overall
backend architecture and the [root CLAUDE.md](../../../CLAUDE.md) for the product picture.

## What this is

`src/TODO/` holds modules carried over **as-is** from the pre-refactor backend (the flat, non-domain
NestJS app that `backend/deprecated/` is a full copy of). They are still live and wired into
`AppModule` — this is not dead code:

- `deals/` — Bitrix24 deal listing/filters endpoint (`GET /deals` + stages/models/managers/sources
  lookups), reading through the old `DatabaseService`.
- `priceMonitoring/` — bulk price-update workflows: uploading a spreadsheet to update Shop
  (МойСклад) product costs, and an AI-assisted flow (`AiService` + prompts) to update Service
  (RoApp) prices, with SSE-based job progress reporting.
- `reports/` — service sales-funnel and services-sold analytics reports, queried straight off
  Prisma-generated deal/order types via `DatabaseService`.

They depend on real, currently-maintained pieces of the app (`integrations/bitrix`,
`integrations/ai`, `integrations/google-sheets`, `domains/shop/integrations/moySklad`,
`domains/service/integrations/roapp`, `infrustructure/database/database.service`) — so these aren't
isolated legacy leftovers you can ignore when changing those integrations. Grep for usages here too
before renaming/removing anything they import.

## Why this folder exists

Each of these modules eventually belongs inside a business-line domain (`domains/service` for
`deals`/`reports`, a mix of `domains/service`/`domains/shop` for `priceMonitoring`), rewritten to
follow the domain/application/infrastructure/interface layering described in the backend CLAUDE.md.
That rewrite hasn't happened yet, and **is intentionally not part of the current scope** — moving a
module out of `TODO/` on a whim mid-refactor risks destabilizing the domain structure that's still
being built out. Leave them here, working as they are, until a task explicitly picks one up for
migration.

## Rules when touching these files

- **Not a style reference.** Don't copy patterns from `deals/`, `priceMonitoring/`, or `reports/`
  into new or refactored domain code, and don't cite them as precedent in reviews. They predate the
  CQRS/DDD layering, inject `DatabaseService`/`PrismaClient` directly instead of going through the
  unit-of-work port, have no domain/application/infrastructure/interface split, and mix
  business logic straight into controllers/services.
- **Don't "fix" the architecture opportunistically.** If a task needs a small bugfix or a new field
  here, make the minimal change in the existing flat style — don't restructure the module into the
  DDD layout as a drive-by; that's a dedicated migration task of its own.
- **Reading them for context is fine, trusting them isn't.** When these files are the only source
  for how e.g. deal stages or price-monitoring jobs currently behave, that behavior is real and
  worth understanding — but treat naming, layering, and error-handling choices here as historical
  artifacts, not intentional decisions to preserve.
- If a task *is* explicitly about migrating one of these modules into a domain, follow the layering
  and conventions in the backend CLAUDE.md, not the code being migrated.