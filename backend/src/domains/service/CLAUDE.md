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
см. `src/shared/initialUploadData.ts`), крон покрывает только заказы.

### `modules/accounting` — зарплатные схемы, расчётный период и отчёты

Единственный в проекте модуль, полностью выстроенный по целевой DDD/CQRS-слоистости
(`domain`/`application`/`infrastructure`/`interface`) — используй его как образец при рефакторинге
или добавлении нового модуля (в том числе для `shop`, см. ниже, который его зеркалирует, но
самостоятельно). Основной источник замысла — `docs/payroll/prd-payroll-calculation.md` и
`docs/payroll/plan-payroll-calculation.md` в корне репозитория (Фазы 1–9 покрывают всё, что описано
в этом разделе).

- **Мотивационная схема** (`MotivationSchemaEntity`) — агрегат, объединяющий набор зарплатных правил
  сотрудника/должности.
- **Зарплатные правила** (`domain/entities/salary-rules/*`) — четыре типа правил как отдельные
  сущности: `PayPerHoursEntity` (почасовая оплата), `ServiceCompletedEntity` (оплата за выполненную
  услугу), `OrderPayedEntity` (вознаграждение за оплаченный заказ), `TaskCompletedEntity`
  (вознаграждение за подтверждённую выполненную задачу). Тип правила резолвится через
  `salary-rule-registry.ts` (`Map<SalaryRuleTypes, SalaryRuleClass>`) и создаётся фабрикой
  `domain/factories/salary-rule.factory.ts` — при добавлении нового типа правила регистрируй его в
  обоих местах. `PeriodCalculationOrchestrator` (`domain/services/`) вызывает `calculate()` каждого
  правила схемы и суммирует строки — правила независимы, не ссылаются на результаты друг друга.
- **Команды** (`application/command/`): помимо создания схемы/правила — `CloseAccountingPeriodCommand`,
  `ReopenAccountingPeriodCommand`, `RecalculateAccountingPeriodCommand` и CRUD `TaskCompletion`
  (`Create/Delete...`, `ConfirmTaskCompletion`) — стандартный `@nestjs/cqrs`
  `CommandBus` (`CqrsModule` импортирован в `accounting.module.ts`). CRUD `EmployeeHoursEntry` (Фаза 7)
  удалён Фазой 5 `docs/employee-work-schedule` — источник часов `PayPerHour` теперь общий модуль
  `modules/work-schedule` (см. ниже).
- **События**: `MotivationSchemaCreatedDomainEvent` → `MotivationSchemaCreatedEventHandler`;
  `AccountingPeriodClosedDomainEvent` → `AccountingPeriodClosedEventHandler` (создаёт снапшот).
- HTTP-вход: `CreateMotivationSchemaHttpController`, эндпоинты периода/отчётов/задач (см.
  `ENDPOINTS.md`, раздел `domains/service/modules/accounting`). Правила зарплаты (`/salary-rules/*`
  из `ENDPOINTS.md`) обслуживаются другим, ещё не мигрированным модулем `salary` (см.
  закомментированный импорт `SalaryModule` в `app.module.ts`) — не путай его с `accounting`, они пока
  частично дублируют предметную область на время переноса.
- **Роли и правила расчёта (Фазы 7–8)**: `domain/services/service-role-source.ts`
  — маппинг «роль правила → поле ERP RoApp» и функция `employeeMatchesServiceRole`, общая точка,
  которую переиспользуют все четыре правила для ролевой выборки (кроме `OrderPayedEntity` в роли
  `ENGINEER`, которая матчится по позициям заказа, а не по одному полю — см. комментарий в
  `order-payed.entity.ts`). `domain/services/money.ts` — `roundRubles()`, единая точка округления
  процентных начислений (целые рубли, `Math.round`) для всего модуля. `domain/services/float-percent.ts`
  — `resolveFloatPercentMultiplier()`, разрешение множителя `FloatPercent` по границам процента
  выполнения плана. `application/services/build-service-calculation-context.service.ts`
  — единственное место, где `CalculationContext.erpData`/`employee.identities` реально заполняются из
  БД (`ServiceCalculationDataPort`/`ServiceCalculationDataRepository`): собирает вход для оркестратора
  и для `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService`, и для
  `CloseAccountingPeriodHandler`. Источник часов `PayPerHour` (Фаза 5,
  `docs/employee-work-schedule`) — сумма часов рабочих смен графика (`WorkScheduleEntry.status =
  WORKING` за период), читаемая `ServiceCalculationDataRepository.findHoursWorked` напрямую из общего
  модуля `modules/work-schedule` (не через его HTTP-порт); прежний ручной ввод часов (CRUD-эндпоинты
  под `/v1/service/accounting`, теперь удалённые вместе с моделью) заменён этим источником, данные
  перенесены разовой миграцией (`npm run migrate:work-schedule-hours`). Источник `TaskCompleted` —
  `TaskCompletion` (`domain/entities/task-completion.entity.ts`) — временный внутренний двухступенчатый
  воркфлоу подтверждения (сотрудник отмечает выполненной → руководитель подтверждает `CONFIRMED`) без
  интеграции с Bitrix24 Tasks (реальная синхронизация запланирована отдельной будущей фазой); только
  подтверждённые записи участвуют в расчёте. Prisma-модель `TaskCompletion` общая для `service`/`shop`
  (дискриминатор `direction`, дефолт `'service'`, Фаза 13) — с Фазы 13.5 у `shop` есть собственный,
  независимый CQRS-вход для записи этих задач (`ShopTaskCompletion`, см. `domains/shop/CLAUDE.md`),
  пишущий в ту же таблицу с `direction: 'shop'`.
- **Расчётный период (`AccountingPeriod`, Фаза 6)** — `direction` + `period` (`YYYY-MM`) как
  естественный ключ, сервис и магазин закрываются независимо; период без записи в БД трактуется как
  `OPEN` (см. `AccountingPeriodRepositoryPort.findByDirectionAndPeriod`). `close()`/`reopen()` —
  переходы статуса на агрегате; проверка «все строки плана продаж утверждены» перед закрытием —
  ответственность `CloseAccountingPeriodHandler` (знает про модуль `sales` через
  `SALES_PLAN_REPOSITORY`), не самой сущности. Закрытие создаёт неизменяемый снапшот по каждому
  сотруднику с личной мотивационной схемой (`AccountingPeriodSnapshotPort`) — закрытый период отчёты
  читают из снапшота (`prognose` не хранится, только `fact`), открытый — считает заново через ленивый
  кэш (`ACCOUNTING_CALCULATION_CACHE`, ключ `(direction, period, employeeId)`), инвалидируемый штампом
  свежести (`accounting-cache-freshness.ts`: версия мотивационной схемы + штамп последней успешной
  синхронизации ERP + штамп последнего изменения плана продаж).
- **Отчёты (Фаза 9)** — `GetEmployeeSalaryReportService` (`GET
  /v1/service/accounting/salary_report/employee/:id/:period`) и `GetDepartmentSalaryReportService`
  (`GET .../department/:id/:period`) используют один и тот же расчёт
  (`PeriodCalculationOrchestrator` + `rule.calculate()`); отчёт отдела — сумма отчётов сотрудников
  отдела, но контекст (ERP-данные, `SalesPerformance`, схемы, идентичности, часы) собирается **один
  раз на весь отдел**, а не на каждого сотрудника — чтобы не было N+1. Оба режима расчёта — `FACT` и
  `PROGNOSE` — считаются параллельно; `PROGNOSE` берёт `SalesPrognose.percentCompletion` вместо
  `SalesFact.percentCompletion` для `FloatPercent`, личная база сотрудника не экстраполируется.

### `modules/sales` — план/факт/прогноз продаж (Фазы 3–5) + сделки/лиды (в разработке)

Модуль объединяет два независимых среза с общим route-неймспейсом `/v1/service/sales/*` и общей
бизнес-областью "продажи", но без переиспользования кода между ними — слоистость и провайдеры у
каждого свои.

**План продаж, факт и прогноз** (`docs/payroll/plan-payroll-calculation.md`, Фазы 3–5) — выстроен по
целевой DDD/CQRS-слоистости, как `accounting`:

- `SalesPlanTemplate` (`GET|PUT /v1/service/sales/plan_template`) — дефолтные значения плана по
  отделу и, опционально, категории, с процентом ежемесячного роста; `PUT` — upsert по естественному
  ключу `(direction, department, category)`.
- `SalesPlan` (`POST|GET|PATCH|DELETE /v1/service/sales/plan`,
  `POST /v1/service/sales/plan/approve`) — план на конкретный месяц; `source`
  (`PREVIOUS_MONTH`/`TEMPLATE`/`MANUAL`) и `status` (`CREATED`/`APPROVED`) — см.
  `SalesPlan.edit()`/`.approve()`.
- Автосоздание планов (Фаза 4) — `EnsureSalesPlansForPeriodService.ensure(direction, period)`:
  для каждой комбинации отдел/категория без строки в текущем периоде берёт план предыдущего
  месяца + `growthPercent` (`source = PREVIOUS_MONTH`), а если предыдущего плана нет — строку
  шаблона без надбавки (`source = TEMPLATE`); уже существующие строки (в т.ч. `APPROVED`/`MANUAL`)
  не трогает. Два входа в одну операцию: `SalesPlanAutoCreationCron`
  (`infrastructure/cron/`, `@ProdCron` первого числа, только `direction = 'service'`) и ленивое
  достраивание внутри `ListSalesPlansService` при каждом `GET /v1/service/sales/plan` —
  обязательное, так как `@ProdCron` не тикает в dev. Крон выполняется вне HTTP-запроса, поэтому
  оборачивается в `runInSystemRequestContext`
  (`shared/application/context/run-in-system-context.ts`) — без него репозитории падают:
  домен/`DatabaseService.getClient()` читают `RequestContext`, который вне запроса никем не открыт.
- `category` — строка (`string | null`; для `shop` — UUID папки МойСклад, см. `domains/shop/CLAUDE.md`),
  хранится в БД сентинелом `NO_CATEGORY_ID = ''` вместо `NULL` (Postgres не считает два `NULL`
  равными в составном уникальном индексе) — см. комментарий в
  `infrastructure/mappers/sales-plan.mapper.ts`; наружу модуля сентинел не протекает.
- `SalesPerformance` (Фаза 5, `GET /v1/service/sales/salesPerformance/:period?direction`) —
  `GetSalesPerformanceService` (единственная реализация `SalesPerformanceReaderPort`) на каждый вызов
  пересчитывает `SalesFact` (агрегат по ERP через `ServiceSalesFactSourcePort`,
  `RoappSalesFactSourceRepository`) и `SalesPrognose` (`SalesPrognose.forPeriod()`, общая формула в
  `src/shared/domain/`) поверх плана — ни факт, ни прогноз нигде не персистятся, это и есть механизм,
  которым «изменение плана пересчитывает факт и прогноз». Жёстко привязан к `direction = 'service'`
  (`SalesPerformanceDirectionNotSupportedException` для любого другого значения) — читает RoApp/
  RemOnline напрямую; аналог для `shop` — отдельный эндпоинт `domains/shop/modules/sales`, см.
  `domains/shop/CLAUDE.md`, а не параметр `direction` этого же роута.
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
  `shop-sales.module.ts` заводит для них собственные экземпляры тех же классов (Nest DI не делит
  провайдеров между модулями без явного экспорта) — подробности и обоснование в комментарии в начале
  `shop-sales.module.ts`.

**Сделки/лиды** — гораздо более ранняя стадия, чем остальной модуль, сейчас это фактически только
read-side:

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
  обработчиков событий для этого среза пока не существует. HTTP-эндпоинты списка сделок и пяти
  справочников (`GET /v1/service/sales/deals*`, бывший `TODO/deals`, Фаза 2
  `docs/todo-modules-ddd-refactoring`) при этом есть — см. `interface/http-controllers/list-deal*` —
  это отдельный read-side слой поверх `DealListRepository`/`DealCatalogRepository`, не связанный с
  заготовками `LeadEntity`/`DealEntity` выше.

## Целевой набор модулей домена

`service` и `shop` — параллельные бизнес-направления с похожим набором бизнес-процессов, поэтому
итоговая структура `modules/` у них похожая, но бизнес-логика внутри каждого процесса разная (разные
ERP, разные правила) — это **не общий переиспользуемый код**, а зеркальный, но независимый набор
модулей в каждом домене, за двумя осознанными исключениями: модели `SalesPlan`/`SalesPlanTemplate`/
`TaskCompletion`, общие на уровне Prisma-схемы с дискриминатором `direction` (см. выше), и CRUD плана/
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
— обновление цен и себестоимости услуг RoApp (`POST
/v1/service/marketing/pricing/update-service-prices`), см. `ENDPOINTS.md`. Остальная часть маркетинга
(источники обращений, кампании и их эффективность) в этом модуле пока не покрыта.

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
  `prisma/schema/salary.prisma` (`MotivationSchema`/`SalaryRule`/`TaskCompletion` — `TaskCompletion`
  общая с `shop`, дискриминатор `direction`; `EmployeeHoursEntry` удалена Фазой 5, см.
  `prisma/schema/work-schedule.prisma`),
  `prisma/schema/accounting-period.prisma` (`AccountingPeriod`/`AccountingCalculationCache`/
  `AccountingPeriodSnapshot`), `prisma/schema/sales.prisma` (`SalesPlan`/`SalesPlanTemplate`, тоже
  общие с `shop` через `direction`) и `prisma/schema/bitrix.prisma` (общие с CRM-контуром, читаются
  `sales`).
- Тесты интеграций: `roapp/roapp.service.spec.ts`, `custom-api-roapp/custom-api-roapp.service.spec.ts`.
  `accounting` и срез плана продаж/`SalesPerformance` модуля `sales` покрыты юнит- и e2e-тестами;
  срез сделок/лидов — нет.