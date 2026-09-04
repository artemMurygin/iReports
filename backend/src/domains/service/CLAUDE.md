# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Домен **`service`** — ремонт и обслуживание техники Apple, основное направление бизнеса iRepair и
самый развитый домен в проекте (см. [корневой CLAUDE.md](../../../../CLAUDE.md) и
[backend/CLAUDE.md](../../../CLAUDE.md) для общей картины и слоистого DDD-паттерна модулей, на
который тут ссылаемся). ERP-система направления — **REM Online**, в проекте везде называется **RoApp**.

## Именование файлов

Внутри `domains/service/*` не добавляй слово `service` в имя файла (`service-role-source.ts`,
`service-completed.entity.ts` и т.п.) — путь уже однозначно задаёт домен
(`domains/service/modules/accounting/...`), повторение слова в каждом файле только засоряет кодовую
базу и усложняет чтение. Называй файл нейтрально: `role-source.ts`, `completed.entity.ts` (там, где
без уточнения название конфликтовало бы с чем-то в той же папке — уточняй смыслом, а не словом
`service`). Правило касается только имени файла — класс/интерфейс/DI-токен внутри по-прежнему называй с
явным префиксом, где домен не следует из контекста использования. См. симметричное правило и уже
проведённое переименование в `domains/shop/CLAUDE.md`; в `domains/service` часть файлов ещё не
приведена к этому правилу (например, `service-role-source.ts`, `service-completed.entity.ts`,
`service-calculation-data.repository.ts`) — не копируй этот старый паттерн в новых файлах, а при
следующем удобном рефакторинге приводи такие файлы в соответствие.

## Структура

```
domains/service/
├── integrations/
│   ├── roapp/             — обёртка над публичным REST API RemOnline
│   ├── custom-api-roapp/  — обёртка над кастомным собственным бэкендом-компаньоном на стороне RoApp
│   └── roapp-gateway/     — единая точка входа, скрывающая, что за ней два разных транспорта
├── sync/roapp/            — cron-синхронизация RoApp → локальная БД
└── modules/
    ├── accounting/        — зарплатные схемы, правила мотивации, расчётный период и отчёты
    │                         (полностью выстроенный DDD/CQRS, Фазы 1–2, 6–9)
    └── sales/              — план/факт/прогноз продаж (Фазы 3–5) + сделки/лиды (ранняя стадия,
                              в основном read-side)
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
см. `src/scripts/initialUploadData.ts` и `application/command/upload-initial-roapp-data.handler.ts`
в этой же папке — сама последовательность вызовов теперь в CQRS-хендлере, а не в скрипте), крон
покрывает только заказы.

### `modules/accounting` — зарплатные схемы, расчётный период и отчёты

Единственный в проекте модуль, полностью выстроенный по целевой DDD/CQRS-слоистости
(`domain`/`application`/`infrastructure`/`interface`) — используй его как образец при рефакторинге
или добавлении нового модуля (в том числе для `shop`, см. ниже, который его зеркалирует, но
самостоятельно).

Бизнес-правила модуля (из чего складывается начисление, жизненный цикл расчётного периода,
устройство зарплатных отчётов) описаны в
[`openspec/specs/service/accounting/spec.md`](../../../../openspec/specs/service/accounting/spec.md)
— ищи их там, а не здесь; этот раздел — только карта «правило → где в коде». Пока
`openspec/changes/docs-migration-to-openspec` не заархивирован, актуальная версия спека временно
лежит по пути `openspec/changes/docs-migration-to-openspec/specs/service/accounting/spec.md` — после
архивации переедет по ссылке выше без изменения содержания. Основной источник замысла на момент
реализации — `docs/payroll/prd-payroll-calculation.md` и `docs/payroll/plan-payroll-calculation.md`
(Фазы 1–9).

- **Мотивационная схема** — `MotivationSchemaEntity` (агрегат).
- **Зарплатные правила** — `domain/entities/salary-rules/*` (`PayPerHoursEntity`,
  `ServiceCompletedEntity`, `OrderPayedEntity`); тип резолвится через `salary-rule-registry.ts`
  (`Map<SalaryRuleTypes, SalaryRuleClass>`), создаётся фабрикой
  `domain/factories/salary-rule.factory.ts` — при добавлении нового типа правила регистрируй его в
  обоих местах. Оркестрация расчёта — `PeriodCalculationOrchestrator` (`domain/services/`).
- **Команды** (`application/command/`): создание схемы/правила, `CloseAccountingPeriodCommand`,
  `ReopenAccountingPeriodCommand`, `RecalculateAccountingPeriodCommand` — стандартный `@nestjs/cqrs`
  `CommandBus` (`CqrsModule` импортирован в `accounting.module.ts`).
- **События**: `MotivationSchemaCreatedDomainEvent` → `MotivationSchemaCreatedEventHandler`;
  `AccountingPeriodClosedDomainEvent` → `AccountingPeriodClosedEventHandler` (создаёт снапшот).
- HTTP-вход: `CreateMotivationSchemaHttpController`, эндпоинты периода/отчётов/задач (см.
  `ENDPOINTS.md`, раздел `domains/service/modules/accounting`). Правила зарплаты (`/salary-rules/*`
  из `ENDPOINTS.md`) обслуживаются другим, ещё не мигрированным модулем `salary` (см.
  закомментированный импорт `SalaryModule` в `app.module.ts`) — не путай его с `accounting`, они пока
  частично дублируют предметную область на время переноса.
- **Ключевые классы для навигации по коду**: `domain/services/service-role-source.ts` (маппинг
  «роль правила → поле ERP RoApp», `employeeMatchesServiceRole`), `domain/services/money.ts`
  (`roundRubles()`), `domain/services/float-percent.ts` (`resolveFloatPercentMultiplier()`),
  `application/services/build-service-calculation-context.service.ts` (единственное место, где
  `CalculationContext.erpData`/`employee.identities` заполняются из БД через
  `ServiceCalculationDataPort`/`ServiceCalculationDataRepository`), `accounting-cache-freshness.ts`
  (штамп свежести ленивого кэша расчёта открытого периода — `ACCOUNTING_CALCULATION_CACHE`),
  `ServiceCalculationDataRepository.findHoursWorked` (источник часов из `modules/work-schedule`, не
  через его HTTP-порт; прежний ручной ввод часов заменён этим источником разовой миграцией
  `npm run migrate:work-schedule-hours`), `CloseAccountingPeriodHandler` (знает про модуль `sales`
  через `SALES_PLAN_REPOSITORY`), `AccountingPeriodSnapshotPort`/`AccountingPeriodRepositoryPort`.
- Отчёты — `GetEmployeeSalaryReportService` (`GET
  /v1/service/accounting/salary_report/employee/:id/:period`),
  `GetDepartmentSalaryReportService` (`GET .../department/:id/:period`), оба поверх
  `PeriodCalculationOrchestrator` + `rule.calculate()`.

### `modules/sales` — план/факт/прогноз продаж (Фазы 3–5) + сделки/лиды (в разработке, read-only)

Модуль объединяет два независимых среза с общим route-неймспейсом `/v1/service/sales/*` и общей
бизнес-областью "продажи", но без переиспользования кода между ними — слоистость и провайдеры у
каждого свои.

Бизнес-правила модуля (шаблон и план продаж, их автосоздание и утверждение, факт и прогноз,
классификация сделок воронки и её KPI, read-side список сделок/лидов) описаны в
[`openspec/specs/service/sales/spec.md`](../../../../openspec/specs/service/sales/spec.md) — ищи их
там, а не здесь; этот раздел — только карта «правило → где в коде». Основной источник замысла на
момент реализации плана/факта/прогноза — `docs/payroll/plan-payroll-calculation.md` (Фазы 3–5).

**План продаж, факт и прогноз** — выстроен по целевой DDD/CQRS-слоистости, как `accounting`:

- `SalesPlanTemplate` (`GET|PUT /v1/service/sales/plan_template`) — `PUT` upsert по естественному
  ключу `(direction, department, category)`.
- `SalesPlan` (`POST|GET|PATCH|DELETE /v1/service/sales/plan`,
  `POST /v1/service/sales/plan/approve`) — план на конкретный месяц; `source`
  (`PREVIOUS_MONTH`/`TEMPLATE`/`MANUAL`) и `status` (`CREATED`/`APPROVED`) — см.
  `SalesPlan.edit()`/`.approve()`.
- Автосоздание планов (Фаза 4) — `EnsureSalesPlansForPeriodService.ensure(direction, period)`. Два
  входа в одну операцию: `SalesPlanAutoCreationCron` (`infrastructure/cron/`, `@ProdCron` первого
  числа, только `direction = 'service'`) и ленивое достраивание внутри `ListSalesPlansService` при
  каждом `GET /v1/service/sales/plan` — обязательное, так как `@ProdCron` не тикает в dev. Крон
  выполняется вне HTTP-запроса, поэтому оборачивается в `runInSystemRequestContext`
  (`shared/application/context/run-in-system-context.ts`) — без него репозитории падают:
  домен/`DatabaseService.getClient()` читают `RequestContext`, который вне запроса никем не открыт.
- Глобальный порядок строк плана — `domain/services/order-sales-plans.ts`
  (`orderSalesPlansByTemplate()`), унаследован от `SalesPlanTemplate.sortOrder`; батч-эндпоинт
  переупорядочивания — `UpdateSalesPlanOrderHandler`, трогает только `sortOrder` (см. отдельный от
  `update()` метод `SalesPlanTemplate.reorder()`).
- `category` — строка (`string | null`; для `shop` — UUID папки МойСклад, см. `domains/shop/CLAUDE.md`),
  хранится в БД сентинелом `NO_CATEGORY_ID = ''` вместо `NULL` (Postgres не считает два `NULL`
  равными в составном уникальном индексе) — см. комментарий в
  `infrastructure/mappers/sales-plan.mapper.ts`; наружу модуля сентинел не протекает.
- `SalesPerformance` (Фаза 5, `GET /v1/service/sales/salesPerformance/:period?direction`) —
  `GetSalesPerformanceService` (единственная реализация `SalesPerformanceReaderPort`) на каждый вызов
  пересчитывает `SalesFact` (агрегат по ERP через `ServiceSalesFactSourcePort`,
  `RoappSalesFactSourceRepository`) и `SalesPrognose` (`SalesPrognose.forPeriod()`, общая формула в
  `src/shared/domain/`) поверх плана — читает RoApp/RemOnline напрямую; аналог для `shop` — отдельный
  эндпоинт `domains/shop/modules/sales`, см. `domains/shop/CLAUDE.md`, а не параметр `direction`
  этого же роута.
- Отчёт по воронке сервисных сделок — `GetServiceFunnelReportService` +
  `domain/services/funnel-kpi.calculator.ts` (`calculateServiceFunnelKpi()`) поверх
  `FunnelStageMap` (`domain/value-objects/funnel-stage-map.value-object.ts`,
  `FunnelStageMap.default()` — единственное место в проекте, где Bitrix stage-ID группы воронки
  перечислены буквально) — перенос `serviceFunnelKPICalculation` из легаси
  `src/TODO/reports/reports.helpers.ts` без изменения бизнес-правила.
- Prisma-модели (`SalesPlan`/`SalesPlanTemplate`) общие для `service`/`shop` (поле `direction`), но
  CRUD-роуты — нет: у `/v1/service/sales/plan*` (контроллеры этого модуля) и `/v1/shop/sales/plan*`
  (`domains/shop/modules/sales`, см. `domains/shop/CLAUDE.md`) — два независимых набора HTTP-
  контроллеров, каждый в своём домене. `direction` больше не параметр запроса: его выбирает сервер по
  тому, по какому из двух путей пришёл запрос, — контроллеры `shop` сами подставляют
  `direction: 'shop'` в команды (`CreateSalesPlanCommand` и т.п.) вместо чтения его из тела/query, как
  раньше. При этом дублирования бизнес-логики нет — контроллеры `shop` лишь тонкий HTTP-слой поверх
  тех же классов команд и обработчиков этого модуля (`application/command/*`), зарегистрированных на
  общем `CommandBus` (`CqrsModule` — тот же класс, импортированный в обоих модулях);
  `SALES_PLAN_REPOSITORY`/`SALES_PLAN_TEMPLATE_REPOSITORY`/`ListSalesPlansService`/
  `ListSalesPlanTemplatesService` — обычные DI-провайдеры (не CQRS-хендлеры), поэтому
  `sales.module.ts` заводит для них собственные экземпляры тех же классов (Nest DI не делит
  провайдеров между модулями без явного экспорта) — подробности и обоснование в комментарии в начале
  `sales.module.ts`.

**Сделки/лиды** — гораздо более ранняя стадия, чем остальной модуль, сейчас это фактически только
read-side (read-only поверх уже засинканных данных, без создания/изменения):

- `LeadRepository`/`DealRepository` (`infrastructure/sales.repositories.ts`) читают уже
  засинканные данные напрямую из Prisma и мапят в доменные `LeadEntity`/`DealEntity`:
  - `LeadEntity` — из таблицы `bitrixDeal`, отфильтрованной по
    `categoryId = SERVICE_FUNNEL_CATEGORY_ID (0)` (см. также `CATEGORY_ID` в
    `src/integrations/bitrix/bitrix.service.ts`, откуда синхронизируются все воронки Bitrix). Сама
    синхронизация Bitrix живёт не в этом домене, а в `src/sync/bitrix` + `src/integrations/bitrix`
    (общекорпоративный CRM-контур, общий для доменов).
  - `DealEntity` — из таблицы `roappOrder` (уже засинканной `sync/roapp` выше).
- `api/sales.routes.ts`, `api/schemas/sales.shcemas.ts`, `domain/sales.events.ts`,
  `application/event.handlers.ts` — **пустые файлы-заготовки**: контроллеров, схем запросов и
  обработчиков событий для этого среза пока не существует. HTTP-эндпоинты списка сделок и пяти
  справочников (`GET /v1/service/sales/deals*`, бывший `TODO/deals`, Фаза 2
  `docs/todo-modules-ddd-refactoring`) при этом есть — см. `interface/http-controllers/list-deal*` —
  это отдельный read-side слой поверх `DealListRepository`/`DealCatalogRepository`, не связанный с
  заготовками `LeadEntity`/`DealEntity` выше.

### `modules/reports`

Read-side аналитика проданных услуг направления «Сервис» (Фаза 5, `docs/todo-modules-ddd-refactoring`)
— источник данных `roapp_service_orders`/`roapp_service_categories`/`roapp_order_types`; не путать с
отчётом по воронке сервисных сделок (тот остался в `modules/sales`, читает `bitrix_deals`). В отличие
от `accounting`/`sales`, зарплатных правил модуль не имеет — только чтение и агрегация.

Бизнес-правила модуля (агрегация показателей услуги, дедупликация по заказу, разбивка по периодам и
гранулярность, фильтры по категориям/услугам, валидация диапазона дат, форма справочников) описаны в
[`openspec/specs/service/reports/spec.md`](../../../../openspec/specs/service/reports/spec.md) — ищи
их там, а не здесь; этот раздел — только карта «эндпоинт/класс → где в коде».

- **HTTP-эндпоинты**: `GET /v1/service/reports/services` (`GetServicesAnalyticsHttpController` →
  `GetServicesAnalyticsService`) — аналитика проданных услуг за период с разбивкой по времени;
  `GET /v1/service/reports/service-categories` (`ListServiceCategoriesHttpController` →
  `ListServiceCategoriesService`) — плоский справочник категорий услуг; `GET
  /v1/service/reports/order-type` (`ListOrderTypesHttpController` → `ListOrderTypesService`) —
  справочник типов заказов (используется как справочник значений для `SalaryRule.orderTypeIds` в
  `modules/accounting`).
- **Единственный порт источника данных** — `ServiceSalesSourcePort`/`SERVICE_SALES_SOURCE`
  (`application/ports/service-sales.port.ts`), реализован одним Prisma-репозиторием
  `ServiceSalesRepository` (`infrastructure/repositories/service-sales.repository.ts`) поверх
  `roappServiceOrder`/`roappServiceCategory`/`roappOrderType` — отдельного порта под справочники нет.
- **Доменный слой**: `ServiceSaleEntity` (read-модель строки «услуга × заказ», не агрегат) +
  `ServiceCategory`/`OrderType` VO (`domain/value-objects/`); расчёты вынесены в доменные сервисы
  `service-metrics.calculator.ts` (агрегированные показатели услуги) и
  `period-breakdown.calculator.ts` (разбивка по периодам) поверх `PeriodBucket` VO
  (`domain/value-objects/period-bucket.value-object.ts`, гранулярность день/неделя/месяц).
- Слоистость (`domain`/`application`/`infrastructure`/`interface`) зеркалирует `accounting`/`sales`,
  без переиспользования их кода — не путай `OrderType` этого модуля с одноимённым VO в
  `modules/sales/domain/value-objects/order-type.value-object.ts` (тот обслуживает `Deal` entity в
  другом модуле).

Отдельно, вне скоупа этой миграции документации: тестовая заглушка порта источника данных в
`interface/http-controllers/reports.e2e.spec.ts` не реализует метод `listOrderTypes`, что не ловится
`npm run test`, но всплывает при `tsc --noEmit`, — актуализация заглушки требует отдельной задачи.

### `modules/marketing/pricing`

`marketing` пока существует только в этом узком срезе (Фаза 7 `docs/todo-modules-ddd-refactoring`) —
обновление цен и себестоимости услуг RoApp, `POST /v1/service/marketing/pricing/update-service-prices`
(см. `ENDPOINTS.md`). Слоистость минимальная, без агрегата: `UpdateServicePricesHttpController` →
`UpdateServicePricesCommand` → `UpdateServicePricesHandler` (`application/command/`, `@nestjs/cqrs`) —
единственный сценарий модуля. Хендлер валидирует входные строки через доменный value object
`ServicePriceChange` (`domain/value-objects/`), затем идёт через `ROAPP_GATEWAY` (см. выше,
`integrations/roapp-gateway`): выгружает актуальные услуги и категории, строит иерархический путь
категории, собирает XLSX-файл (формат колонок — как ждёт `CustomApiRoapp /updateServices`) и
отправляет его в RoApp.

Бизнес-правила (валидация строки изменения, молчаливый пропуск услуг, отсутствующих в ERP, маппинг
входной себестоимости в поле вознаграждения ERP, трактовка частичного/полного отказа ERP при
обновлении) описаны в
[`openspec/specs/service/marketing/spec.md`](../../../../openspec/specs/service/marketing/spec.md) —
ищи их там, а не здесь.

Остальная часть маркетинговой области (источники обращений, кампании и их эффективность) в этом
модуле пока не реализована.

## Целевой набор модулей домена

`service` и `shop` — параллельные бизнес-направления с похожим набором бизнес-процессов, поэтому
итоговая структура `modules/` у них похожая, но бизнес-логика внутри каждого процесса разная (разные
ERP, разные правила) — это **не общий переиспользуемый код**, а зеркальный, но независимый набор
модулей в каждом домене, за двумя осознанными исключениями: модели `SalesPlan`/`SalesPlanTemplate`,
общие на уровне Prisma-схемы с дискриминатором `direction` (см. выше), и CRUD плана/
шаблона плана продаж внутри `modules/sales` — там HTTP-контроллеры `shop` напрямую диспатчат те же
классы команд `service` через общий `CommandBus` (см. выше, раздел про `modules/sales`, и
`domains/shop/CLAUDE.md`); эндпоинты (`/v1/service/sales/plan*` и `/v1/shop/sales/plan*`) при этом
независимые, общая только бизнес-логика. Всё остальное, включая `modules/accounting` целиком, —
независимые реализации без переиспользования доменного кода между доменами. Помимо уже существующих
`accounting` и `sales` (реализованы в обоих доменах, см. выше и `domains/shop/CLAUDE.md`) и `reports`
(только в `service` — аналитика проданных услуг и справочник категорий услуг, `roapp_service_orders`/
`roapp_service_categories`, Фаза 5 `docs/todo-modules-ddd-refactoring`; не путать с отчётом по воронке
сервисных сделок — тот остался внутри `modules/sales`, читает `bitrix_deals`), для `service`
планируются:

- **`purchasing`** — закупки (запчастей/расходников у поставщиков). Не существует.
- **`logistics`** — логистика (движение устройств/грузов между приёмкой, сервисными точками,
  поставщиками). Не существует.
- **`warehouse`** — склад/остатки (запчасти, расходники). Не существует.

`marketing` уже существует (`modules/marketing/pricing`, Фаза 7 `docs/todo-modules-ddd-refactoring`)
— обновление цен и себестоимости услуг RoApp, см. раздел "`modules/marketing/pricing`" ниже.

Ремонт как таковой отдельным модулем (`repair`) не планируется — это и есть содержание домена
`service` целиком, выносить его в отдельный модуль внутри самого себя незачем.

Именование модулей — короткое существительное на английском, без домена в названии (не
`service-warehouse`): домен и так задаёт контекст через путь `domains/service/modules/*`. Для
"склада" используем `warehouse`, а не `store` — `store` в этом проекте легко спутать с доменом
`shop` (розничный магазин). Для "закупок" — `purchasing`, а не `procurement`: короче и симметрично
уже используемому `sales`.

## Функциональность домена, ещё не перенесённая в `domains/service`

`src/TODO/` (`deals`, `reports`, `priceMonitoring`) полностью перенесён в `domains/service` (и,
частично, `domains/shop`) и удалён целиком (`docs/todo-modules-ddd-refactoring`): список сделок и
пять справочников — в `modules/sales` (Фаза 2), отчёт по воронке сервисных сделок — тоже в
`modules/sales` (Фаза 4), аналитика проданных услуг и справочник категорий — в новом
`modules/reports` (Фаза 5), обновление цен/себестоимости услуг RoApp — в `modules/marketing/pricing`
(Фаза 7). Не осталось эндпоинтов домена "Сервис", физически лежащих вне `domains/service`, за
единственным исключением ниже.

- Правила зарплаты `/salary-rules/*` и отчёт `/salaryReport*` (модуль `salary`, см.
  `ENDPOINTS.md`) — предшественник `modules/accounting`, ещё не полностью вытесненный: `accounting`
  уже закрывает создание схем/правил, расчётный период и оба отчёта по зарплате, но CRUD над
  отдельными правилами (`salary-rules`) остаётся в старом модуле.

При переносе этой функциональности в `domains/service` — заводить её как `interface`-слой поверх
`modules/accounting`, а не копировать текущую плоскую структуру старого модуля `salary`.

## Данные и тесты

- Prisma-схема: `prisma/schema/roapp.prisma` (собственные таблицы `roapp*`),
  `prisma/schema/salary.prisma` (`MotivationSchema`/`SalaryRule`; `EmployeeHoursEntry` удалена
  Фазой 5, см. `prisma/schema/work-schedule.prisma`),
  `prisma/schema/accounting-period.prisma` (`AccountingPeriod`/`AccountingCalculationCache`/
  `AccountingPeriodSnapshot`), `prisma/schema/sales.prisma` (`SalesPlan`/`SalesPlanTemplate`, тоже
  общие с `shop` через `direction`) и `prisma/schema/bitrix.prisma` (общие с CRM-контуром, читаются
  `sales`).
- Тесты интеграций: `roapp/roapp.service.spec.ts`, `custom-api-roapp/custom-api-roapp.service.spec.ts`.
  `accounting` и срез плана продаж/`SalesPerformance` модуля `sales` покрыты юнит- и e2e-тестами;
  срез сделок/лидов — нет.