# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Backend of the iReports monorepo. See the [root CLAUDE.md](../CLAUDE.md) for the overall
product/architecture picture. This file covers backend-specific commands and conventions.

## Приоритет инструкций

Паттерны, подсказки по код-стилю и архитектуре, описанные в этом файле (и в CLAUDE.md доменов,
`src/domains/service/CLAUDE.md`, `src/domains/shop/CLAUDE.md`), важнее того, что фактически
встречается в существующем коде. Часть кодовой базы ещё не приведена к целевой архитектуре
(см. «Architecture» ниже) — не копируй паттерн только потому, что он уже где-то использован;
ориентируйся на то, что написано здесь, даже если это расходится с наблюдаемым кодом.

## Commands

Run from `backend/`.

All tooling config files (`tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`,
`.prettierrc`, `prisma.config.ts`) live at the `backend/` root, except `app.routes.ts` which stays under
`src/config/` (imported via the `@/config/app.routes` alias). The npm scripts below already point at
the root config files via the relevant `-c`/`-p`/`--config` flags. Pass the same flag if you invoke
`nest`/`eslint`/`prettier`/`tsc-alias`/`prisma` directly instead of through `npm run`.

```bash
npm run start:dev          # nest start --watch + tsc-alias watcher (path aliases resolved on the fly)
npm run build               # nest build -c nest-cli.json && tsc-alias -p tsconfig.build.json
npm run start:prod          # node dist/main (requires build first)
npm run lint                 # eslint --config eslint.config.mjs --fix over src/apps/libs/test
npm run format                # prettier --config .prettierrc --write src/**/*.ts test/**/*.ts

npm run test                    # jest, all *.spec.ts under src
npm run test -- deals.service    # jest, filter by filename/testname pattern
npm run test -- --testPathPatterns=domains/service/modules/sales
npm run test:watch
npm run test:cov
npm run test:e2e                # separate jest config: test/jest-e2e.json
```

Prisma (schema lives in `prisma/schema/*.prisma`, config in `prisma.config.ts`):

```bash
npx prisma generate --config prisma.config.ts             # regenerate client into prisma/generated/prisma/schema
npx prisma migrate dev --config prisma.config.ts --name x  # create+apply a migration (prisma/migrations)
npx prisma studio --config prisma.config.ts
```

One-off scripts (build first, they run from `dist/`):

```bash
npm run initial                  # nest build -c nest-cli.json && node dist/src/scripts/initialUploadData.js
npm run price:monitoring         # nest build -c nest-cli.json && node dist/src/utils/runPriceMonitoring.js
```

To run a single test file directly with ts-jest, `cd backend` and use the `test` script with a path/name
filter (jest's `rootDir` is `src`, so paths are relative to `src/`) — see above.

## Architecture

The backend is organized as a DDD/domain-oriented structure under `src/domains/{opt,service,shop}`
(see root CLAUDE.md for what each domain means) — this is where all features live. `service` and
`shop` each have their own CLAUDE.md with domain-specific detail:
[`domains/service/CLAUDE.md`](./src/domains/service/CLAUDE.md),
[`domains/shop/CLAUDE.md`](./src/domains/shop/CLAUDE.md). `opt` is an empty placeholder directory.

`src/TODO/` (a staging area for modules — `deals`, `reports`, `priceMonitoring` — carried over as-is
from the pre-DDD backend, pending refactor into a domain) has been fully migrated into
`src/domains/service/modules/{sales,reports,marketing/pricing}` and
`src/domains/shop/modules/marketing/pricing` and no longer exists — don't expect to find it, and
don't treat any lingering reference to it elsewhere as current.

The previous, pre-refactor backend (`backend/deprecated/`) has been removed now that the migration
no longer needs it as a reference — don't expect it to exist.

`src/app.module.ts` documents any remaining not-yet-migrated functionality in comments
(`TODO: не мигрировано...`) — check it before assuming a module has (or hasn't) been ported.

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

#### Value objects

В доменном слое value object (наследник `value-object.base.ts`, см.
`src/domains/service/modules/sales/domain/value-objects/*` как референс) обязателен везде, где для
поля/группы полей сущности характерны: собственная валидация или инварианты (например, диапазон,
формат, допустимый набор значений), сравнение по значению, а не по идентичности, или группа полей,
которые всегда меняются вместе и имеют самостоятельный смысл (деньги/сумма+валюта, диапазон дат,
адрес, статус с ограниченным набором переходов, контактные данные и т.п.). Примитивы (`string`,
`number`) прямо в полях сущности допустимы только для действительно простых, не требующих валидации
атрибутов (например, суррогатный технический идентификатор без собственной семантики).

Если при работе с сущностью в домене (создание/рефакторинг модуля, ревью, ответ на вопрос) видно, что
для одного из её полей по этим критериям нужен value object, а сейчас там голый примитив —
добавь value object, даже если это не было явно запрошено, и обнови сущность, мапперы и (если
затронуты) zod-схемы персистентности, чтобы они использовали новый тип.

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

### Swagger/OpenAPI — обязательно для каждого нового эндпоинта

Документация Swagger — не опциональный шаг, а обязательная часть создания HTTP-эндпоинта. Любой
новый `*.http-controller.ts` в `src/domains/{service,shop}` или `src/modules/*` должен при создании
получить:

- `@ApiTags('<Домен>: <модуль/область>')` на классе контроллера (см. существующие контроллеры в
  `src/domains/service/modules/accounting/interface/http-controllers/` как образец формулировки —
  по-русски, `Область: подобласть`).
- `@ApiOperation({ summary: '...' })` на каждом HTTP-методе — короткое описание того, что делает
  эндпоинт, по-русски.
- Тело запроса — через `nestjs-zod`-DTO (`createZodDto`), Swagger выводит схему автоматически из
  него без дополнительных декораторов. Если DTO с `createZodDto` невозможен (union-схема тела —
  см. пример в `src/shared/utils/zod-schema-to-open-api-body.ts`), явно передай схему через
  `@ApiBody({ schema: zodSchemaToOpenApiBody(...) })`, а не оставляй тело недокументированным.
- Тип ответа — типизированный возврат метода контроллера (тип из `ireports-contracts`), этого
  достаточно для схемы ответа в Swagger; не нужен отдельный `@ApiResponse`, если в проекте не
  появится такой паттерн.

Контроллер, у которого нет `@ApiTags`/`@ApiOperation`, считается незавершённым — не сдавай задачу с
эндпоинтом без них, даже если это не было явно оговорено в задаче.

**Подключение нового модуля в Swagger UI.** Контроллер попадает в `/docs/*` только если его модуль
явно перечислен в `include: [...]` соответствующего `DocumentBuilder`-документа в
`src/config/swagger.config.ts`. При создании нового DDD-модуля в `domains/service/modules/*` или
`domains/shop/modules/*` (или нового сквозного модуля вроде `employee-identity`) — добавь его класс
модуля в `include` нужного документа (`serviceDocument` для `domains/service`, `shopDocument` для
`domains/shop`, `commonDocument` для сквозных модулей вне `service`/`shop`) в том же PR, где модуль
заводится. Модули из `src/TODO/*` в Swagger сознательно не документируются (см. комментарий над
`setupSwagger` в `swagger.config.ts`) — это осознанное исключение для устаревшего кода, ждущего
переноса в домен, а не образец для новых модулей.