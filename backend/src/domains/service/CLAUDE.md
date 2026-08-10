# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Домен **`service`** — ремонт и обслуживание техники Apple, основное направление бизнеса iRepair и
самый развитый домен в проекте (см. [корневой CLAUDE.md](../../../../CLAUDE.md) и
[backend/CLAUDE.md](../../../CLAUDE.md) для общей картины и слоистого DDD-паттерна модулей, на
который тут ссылаемся). ERP-система направления — **REM Online**, в проекте везде называется **RoApp**.

## Структура

```
domains/service/
├── integrations/
│   ├── roapp/             — обёртка над публичным REST API RemOnline
│   ├── custom-api-roapp/  — обёртка над кастомным собственным бэкендом-компаньоном на стороне RoApp
│   └── roapp-gateway/     — единая точка входа, скрывающая, что за ней два разных транспорта
├── sync/roapp/            — cron-синхронизация RoApp → локальная БД
└── modules/
    ├── accounting/        — зарплатные схемы и правила мотивации (полностью выстроенный DDD/CQRS)
    └── sales/              — сделки/лиды (ранняя стадия, в основном read-side)
```

### `integrations/roapp` и `integrations/custom-api-roapp`

Два независимых транспорта к одному и тому же RoApp/RemOnline, потому что у него два разных API:

- **`roapp`** — публичное REST API RemOnline: сотрудники, типы/статусы заказов, маркетинговые
  источники, категории услуг/товаров, услуги, товары, заказы и их позиции. Постраничные выборки
  (категории, услуги, товары, заказы) отдаются как `AsyncGenerator<T[]>` — не грузить всё в память,
  итерировать `for await`.
- **`custom-api-roapp`** — кастомный API, реализованный самой iRepair как надстройка над RoApp,
  закрывает то, чего нет в публичном API: создание услуг (`createService`), бонусы инженеров по
  услугам (`getServiceBonusById`, `getServiceBonusesForEngeneers`), массовое обновление услуг из
  Excel-файла (`updateServices`).

### `integrations/roapp-gateway` — единая точка входа

`RoappGateway` (порт, `roapp-gateway.port.ts`) объединяет оба транспорта за одним интерфейсом;
`RoappGatewayAdapter` делегирует вызовы либо в `RoappService`, либо в `CustomApiRoappService`.
Потребители (в первую очередь `sync/roapp`) зависят только от DI-токена `ROAPP_GATEWAY`, а не от
конкретных сервисов — это единственное место в обоих доменах (`service`/`shop`), где интеграция
скрыта за портом. При добавлении нового потребителя данных RoApp предпочитай инжектить
`ROAPP_GATEWAY`, а не `RoappService`/`CustomApiRoappService` напрямую.

### `sync/roapp` — синхронизация с ERP

`RoappSyncService` тянет данные через `RoappGateway` и делает `upsert` в Prisma-таблицы `roapp*`
(`prisma/schema/roapp.prisma`). Порядок важен там, где есть FK/иерархии:
категории — топологическая сортировка родитель→потомок (`topoSortCategories`) перед upsert; заказы —
сначала сами заказы (`uploadCreatedOrders`/`uploadUpdatedOrders`), затем их позиции
(`uploadOrderItems`, за отдельным проходом с задержкой между заказами — `delay(500)`, чтобы не
душить RoApp rate-limit'ом). Позиции заказа записываются в одной Prisma-транзакции вместе с
пересчётом KPI заказа (`cost`, `engineerSalary`, `managerSalary` — см.
`calculateOrderKPIs`, `managerSalary` = 10% от `payed - cost - engineerSalary`).

`RoappSyncCron` (`@ProdCron(CronExpression.EVERY_5_MINUTES)`, см.
`src/shared/cron/prod-cron.decorator.ts` — крон реально тикает только в проде) синкает только
*обновлённые* заказы. При ошибке `failedSince` запоминается и следующий тик продолжает с этой же
точки, а не сдвигается — так пропуски не теряются, но и не растёт неограниченно окно догонки.
Остальные справочники (сотрудники, статусы, типы заказов, маркетинговые источники, категории,
услуги, товары, бонусы) через cron не гоняются — это ручные/разовые операции (`npm run initial`,
см. `src/shared/initialUploadData.ts`), крон покрывает только заказы.

### `modules/accounting` — зарплатные схемы и правила мотивации

Единственный в проекте модуль, полностью выстроенный по целевой DDD/CQRS-слоистости
(`domain`/`application`/`infrastructure`/`interface`) — используй его как образец при рефакторинге
или добавлении нового модуля, не `sales` (см. ниже).

- **Мотивационная схема** (`MotivationSchemaEntity`) — агрегат, объединяющий набор зарплатных правил
  сотрудника/должности.
- **Зарплатные правила** (`domain/entities/salary-rules/*`) — несколько типов правил как отдельные
  сущности: `PayPerHoursEntity` (почасовая оплата), `ServiceCompletedEntity` (оплата за выполненную
  услугу), плюс `OrderPayedEntity`/`TaskCompletedEntity`. Тип правила резолвится через
  `salary-rule-registry.ts` (`Map<SalaryRuleTypes, SalaryRuleClass>`) и создаётся фабрикой
  `domain/factories/salary-rule.factory.ts` — при добавлении нового типа правила регистрируй его в
  обоих местах.
- **Команды** (`application/command/`): `CreateMotivationSchemaCommand`/`Handler`,
  `CreateSalaryRuleCommand`/`Handler` — стандартный `@nestjs/cqrs` `CommandBus` (`CqrsModule`
  импортирован в `accounting.module.ts`).
- **События**: `MotivationSchemaCreatedDomainEvent` → `MotivationSchemaCreatedEventHandler`
  (application-level side effect после создания схемы).
- HTTP-вход пока один: `CreateMotivationSchemaHttpController`. Правила зарплаты (`/salary-rules/*` из
  `ENDPOINTS.md`) обслуживаются другим, ещё не мигрированным модулем `salary` (см. закомментированный
  импорт `SalaryModule` в `app.module.ts`) — не путай его с `accounting`, они пока частично
  дублируют предметную область на время переноса.

### `modules/sales` — сделки и лиды (в разработке)

Гораздо более ранняя стадия, чем `accounting` — сейчас это фактически только read-side:

- `LeadRepository`/`DealRepository` (`infrastructure/sales.repositories.ts`) читают уже
  засинканные данные напрямую из Prisma и мапят в доменные `LeadEntity`/`DealEntity`:
  - `LeadEntity` — из таблицы `bitrixDeal`, отфильтрованной по
    `categoryId = SERVICE_FUNNEL_CATEGORY_ID (0)` — это воронка Bitrix24, принадлежащая направлению
    "Сервис" (см. также `CATEGORY_ID` в `src/integrations/bitrix/bitrix.service.ts`, откуда
    синхронизируются все воронки Bitrix). Сама синхронизация Bitrix living не в этом домене, а в
    `src/sync/bitrix` + `src/integrations/bitrix` (общекорпоративный CRM-контур, общий для доменов).
  - `DealEntity` — из таблицы `roappOrder` (уже засинканной `sync/roapp` выше).
- `api/sales.routes.ts`, `api/schemas/sales.shcemas.ts`, `domain/sales.events.ts`,
  `application/event.handlers.ts` — **пустые файлы-заготовки**: контроллеров, схем запросов и
  обработчиков событий для этого модуля пока не существует, `sales.module.ts` регистрирует только
  `LEAD_REPOSITORY`. Не удивляйся отсутствию HTTP-эндпоинтов у `sales` — воронка и список сделок
  сейчас обслуживаются через ещё не мигрированный `src/TODO/deals` (см. ниже).

## Целевой набор модулей домена

`service` и `shop` — параллельные бизнес-направления с похожим набором бизнес-процессов, поэтому
итоговая структура `modules/` у них будет похожей, но бизнес-логика внутри каждого процесса разная
(разные ERP, разные правила) — это **не общий переиспользуемый код**, а зеркальный, но независимый
набор модулей в каждом домене. Помимо уже существующих `accounting` и `sales` (см. выше), для
`service` планируются:

- **`purchasing`** — закупки (запчастей/расходников у поставщиков). Не существует.
- **`logistics`** — логистика (движение устройств/грузов между приёмкой, сервисными точками,
  поставщиками). Не существует.
- **`marketing`** — маркетинг (источники обращений, кампании и их эффективность). Не существует.
- **`warehouse`** — склад/остатки (запчасти, расходники). Не существует.

Ремонт как таковой отдельным модулем (`repair`) не планируется — это и есть содержание домена
`service` целиком, выносить его в отдельный модуль внутри самого себя незачем.

Именование модулей — короткое существительное на английском, без домена в названии (не
`service-warehouse`): домен и так задаёт контекст через путь `domains/service/modules/*`. Для
"склада" используем `warehouse`, а не `store` — `store` в этом проекте легко спутать с доменом
`shop` (розничный магазин). Для "закупок" — `purchasing`, а не `procurement`: короче и симметрично
уже используемому `sales`.

## Функциональность домена, ещё не перенесённая в `domains/service`

Часть эндпоинтов, которые по смыслу принадлежат домену "Сервис", физически всё ещё лежит в
`src/TODO/` (см. `backend/CLAUDE.md`) и ждёт переноса в `modules/sales` или новый модуль отчётов:

- **`TODO/deals`** (`/deals*`) — список сделок, этапы, менеджеры, источники — читает `bitrixDeal`
  напрямую (без DDD-слоёв), то, что со временем должно стать HTTP-слоем `modules/sales`.
- **`TODO/reports`** (`/reports/service-funnel`, `/reports/service-categories`,
  `/reports/services-analytics`) — читает `bitrixDeal` (воронка) и `roappServiceCategory`/
  `roappServiceOrder` (аналитика услуг).
- **`TODO/priceMonitoring`**, эндпоинт `/price-monitoring/update-service-price` — обновляет цены
  услуг обратно в RoApp (через `RoappService`/`CustomApiRoappService`, минуя `roapp-gateway`-порт);
  использует также AI-интеграцию (`src/integrations/ai`) для сопоставления названий услуг. Второй
  эндпоинт этого же модуля, `update-shop-products-costs`, относится к домену `shop` — модуль
  обслуживает оба направления сразу.

При переносе этой функциональности в `domains/service` — заводить её как `interface`-слой поверх
`modules/sales` (или нового модуля отчётов), а не копировать текущую плоскую структуру `TODO/*`.

## Данные и тесты

- Prisma-схема: `prisma/schema/roapp.prisma` (собственные таблицы `roapp*`) и
  `prisma/schema/bitrix.prisma` (общие с CRM-контуром, читаются `sales`).
- Тесты на сегодня есть только для интеграций: `roapp/roapp.service.spec.ts`,
  `custom-api-roapp/custom-api-roapp.service.spec.ts`. Ни `sales`, ни `accounting` тестами пока не
  покрыты.
