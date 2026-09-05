# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Домен **`shop`** — розничная продажа новой техники Apple и аксессуаров конечным клиентам (см.
[корневой CLAUDE.md](../../../../CLAUDE.md) и [backend/CLAUDE.md](../../../CLAUDE.md) для общей
картины и слоистого DDD-паттерна модулей). ERP-система направления — **МойСклад (MoySklad)**.

`shop` и `service` — параллельные бизнес-направления с похожим набором бизнес-процессов; `shop`
зеркалирует структуру `service` (см. `domains/service/CLAUDE.md`), но с самостоятельной, независимой
реализацией — общий код в основном ограничен `src/shared/*` и несколькими Prisma-моделями с
дискриминатором `direction` (`SalesPlan`/`SalesPlanTemplate`). Единственное осознанное
исключение из «независимого доменного кода» — CRUD плана и шаблона плана продаж в `modules/sales`
(см. ниже): HTTP-контроллеры `shop` напрямую диспатчат те же классы команд из
`domains/service/modules/sales/application/command/*` через общий `CommandBus`, подставляя
`direction: 'shop'` сами — независимы только эндпоинты (`/v1/shop/sales/plan*`), а не бизнес-логика.
`modules/accounting` от этого исключения свободен и полностью независим от одноимённого модуля
`service`. Домен уже вырос из
состояния «только интеграция и синк» — `modules/accounting` и `modules/sales` частично реализованы
(Фазы 10–13, см. `docs/payroll/plan-payroll-calculation.md` в корне репозитория), но не «планировались
на будущее» полностью — часть слоёв всё ещё сознательно отсутствует, см. ниже.

## Именование файлов

Внутри `domains/shop/*` не добавляй слово `shop` в имя файла (`shop-accounting-period.repository.ts`,
`to-shop-motivation-schema-response.ts`, `in-memory-shop-salary-accrual.repository.ts` и т.п.) — путь
уже однозначно задаёт домен (`domains/shop/modules/accounting/...`), повторение слова в каждом файле
только засоряет кодовую базу и усложняет чтение. Называй файл нейтрально:
`accounting-period.repository.ts`, `to-motivation-schema-response.ts`,
`in-memory-salary-accrual.repository.ts`. Правило касается только имени файла — класс/интерфейс/
DI-токен внутри по-прежнему называй с префиксом `Shop`/`SHOP_` (`ShopAccountingPeriodRepository`,
`SHOP_ERP_CASH_CONFIG_REPOSITORY`): при импорте символа в другом месте (например,
`src/modules/employee-balance`) виден только он, а не путь к файлу, поэтому там домен должен быть
явным в самом имени. См. симметричное правило в `domains/service/CLAUDE.md`.

## Структура

```
domains/shop/
├── integrations/moySklad/  — обёртка над REST API МойСклад
├── sync/moySklad/           — cron-синхронизация MoySklad → локальная БД
└── modules/
    ├── accounting/          — зарплатные правила магазина (Фазы 12–13) + персистентность,
    │                          оркестратор расчёта и HTTP-запись мотивации/задач (Фаза 13.5, см. ниже)
    └── sales/                — SalesPerformance (факт/прогноз по МойСклад, Фаза 11) + собственный
                                 CRUD плана/шаблона плана продаж, тонкий HTTP-слой поверх команд
                                 sales домена service
```

### `integrations/moySklad`

`MoyskladService` (поверх `MoyskladHttpService`) — набор `fetch*`-методов к API МойСклад:
сотрудники, папки товаров (`productFolders`), товары, услуги, контрагенты (`counterparties`),
заказы покупателей (`customerOrders`), отгрузки (`demands`). Постраничные выборки (папки, товары,
услуги, отгрузки) отдаются как `AsyncGenerator<T[]>` с `PAGE_LIMIT = 1000` — тот же паттерн, что у
`roapp` в домене `service`, итерировать через `for await`.

В отличие от `service`, здесь **нет** абстракции вроде `roapp-gateway` — `MoySkladSyncService` и
`modules/marketing/pricing` (см. ниже) инжектят конкретный класс `MoyskladService` напрямую, не
через порт/DI-токен.
Модуль не регистрирует ни одного `@Controller` (`controllers: []` в `moysklad.module.ts`) — данные
наружу отдаются только через `sync`, а не через собственный HTTP API. Если понадобится подменять
источник данных в тестах или добавить второй транспорт (аналогично `custom-api-roapp`), заведи порт
по образцу `service/integrations/roapp-gateway`, а не расширяй `MoyskladService` напрямую.

### `sync/moySklad` — синхронизация с ERP

`MoySkladSyncService` тянет данные и делает `upsert` в Prisma-таблицы `moySklad*`
(`prisma/schema/moySklad.prisma`). `extractIdFromHref` (`moysklad-sync.mappers.ts`) — сквозной
хелпер: API МойСклад отдаёт связи (сотрудник, контрагент, склад, статус...) как `{ meta: { href } }`,
а не голым id, поэтому id приходится вытаскивать из URL почти на каждом маппинге.
`ProductFolderTreeService` (`sync/moySklad/product-folder-tree.service.ts`) живёт в `sync/`, а не в
`modules/accounting`, потому что это чистый Prisma-доступ к `moySklad*`-таблицам без бизнес-логики
правил. `ONLINE_MANAGER_ATTR_ID`/`PURCHASER_ATTRIBUTE_NAME` (`moysklad-sync.mappers.ts`) — id/имена
кастомных атрибутов МойСклад, которыми размечены менеджер и закупщики отгрузки.
`MoySkladSyncCron` — `@ProdCron(CronExpression.EVERY_5_MINUTES)`.

Бизнес-правила синхронизации (что и в каком порядке синкается, полная замена позиций отгрузки при
каждом синке, докатка неизвестных товаров/услуг, резолв закупщиков, курсор докатки при сбое) —
[`openspec/specs/shop/moysklad-sync/spec.md`](../../../../openspec/specs/shop/moysklad-sync/spec.md).

### `modules/sales` — план продаж и SalesPerformance магазина (Фаза 11, 13.5)

Зеркалит структуру и большинство бизнес-правил `domains/service/modules/sales` («план/факт/прогноз»),
но, начиная с `docs/service-shop-boundary-violations-fix`, **полностью независим**: собственные
сущности (`ShopSalesPlan`/`ShopSalesPlanTemplate`), репозитории (`SHOP_SALES_PLAN_REPOSITORY`/
`SHOP_SALES_PLAN_TEMPLATE_REPOSITORY`) и CQRS-хендлеры (`Create/Update/Delete/ApproveShopSalesPlan*`,
`PutShopSalesPlanTemplate*`, `UpdateShopSalesPlanOrder*`) — ни один класс/токен направления `service`
не переиспользуется, диспатч через общий `CommandBus` в хендлеры `service` не производится (см.
`domains/service/CLAUDE.md`, "Общие таблицы между `service` и `shop`" в `backend/CLAUDE.md`).
`SalesPlan`/`SalesPlanTemplate` — общие Prisma-модели с полем `direction` на каждой строке, но каждый
домен обращается к ним только через свой собственный набор классов.

- HTTP: `POST|GET|PATCH|DELETE /v1/shop/sales/plan`, `GET|PUT /v1/shop/sales/plan_template`,
  `POST /v1/shop/sales/plan/approve`, `GET /v1/shop/sales/salesPerformance/:period` (отдельный роут,
  не параметр `direction` — сервисный роут жёстко читает RoApp), см.
  `interface/http-controllers/*.http.controller.ts` и `shopSalesPlanRoot`/`shopSalesPlanTemplateRoot`/
  `shopSalesPerformanceRoot` в `config/app.routes.ts`.
- `ShopSalesFact`/`ShopSalesPerformance` — по `MoySkladDemand`/`MoySkladDemandPosition`.
  `GetShopSalesPerformanceService` (единственная реализация `ShopSalesPerformanceReaderPort`)
  использует ту же формулу прогноза (`SalesPrognose.forPeriod()`, `src/shared/domain/`), что и
  `service`.
- `ShopSalesPlanAutoCreationCron` — собственный крон автосоздания плана первого числа поверх
  `EnsureShopSalesPlansForPeriodService` (собственный класс, не переиспользует сервисный).
- `SHOP_SALES_PERFORMANCE_READER` — DI-порт, которым уже пользуется `modules/accounting`
  (`ProductSoldEntity`/`FloatPercent` принимают его через `context.salesPerformance`).

Бизнес-правила (шаблон/план, автосоздание, глобальный порядок строк, факт/прогноз по МойСклад) —
[`openspec/specs/shop/sales/spec.md`](../../../../openspec/specs/shop/sales/spec.md).

### `modules/accounting` — зарплатные правила магазина (Фазы 12–13.5+)

Полностью независим от одноимённого модуля `domains/service/modules/accounting` — ни один его класс
здесь не импортируется (`domain/services/role-source.ts`, `money.ts`, `float-percent-schedule.ts` —
зеркала, но отдельные файлы), включая расчётный период, документ начисления и зарплатные отчёты (см.
ниже — это тоже полностью самостоятельные классы, а не переиспользование generic-по-`direction`
классов `service`). Собственный реестр (`shopSalaryRuleRegistry`) и фабрика
(`ShopSalaryRuleFactory`) трёх типов правил (`PayPerHourEntity`/`ProductSoldEntity`/
`UsedProductSoldEntity`) — ролей инженера в `shop` нет.

- Роли правил: `ONLINE_MANAGER`/`OFFLINE_MANAGER` — на уровне **отгрузки**
  (`MoySkladDemand.onlineManagerId`/`offlineManagerId`, `role-source.ts`); `ONLINE_PURCHASER`/
  `OFFLINE_PURCHASER` — на уровне **товарной позиции**
  (`MoySkladDemandPosition.onlinePurchaserId`/`offlinePurchaserId`). `salaryBasis`:
  `REVENUE` (`sum`)/`MARGIN` (`profit`) — `SALARY_MINUS_ENGINEER_SALARY` в магазине не существует.
- Категория правила раскрывается до потомков через
  `ProductFolderTreeService.resolveDescendantFolderIds` заранее application-слоем
  (`erpData.categoryDescendantFolderIds`); `FloatPercent` резолвит `percentCompletion` через
  карту `category → percentCompletion` (`ShopSalesPerformanceByCategory`,
  `docs/shop-sales-performance-by-category`), которую строит `BuildShopCalculationContextService`
  через `ShopSalesPerformanceReaderPort.findForScope(period, department, category)`.
- `ShopMotivationSchema` (сущность + `ShopMotivationSchemaMapper`/`Repository`, включая
  `findIdByTarget` — защита от дублирования строки для сотрудника с идентичностями в обеих ERP; у неё
  нет `direction`, ключ только `(targetType, targetId)`). HTTP-запись: `POST
  /v1/shop/accounting/motivation-schema` (find-or-create по `findIdByTarget`).
- Расчёт: `BuildShopCalculationContextService` (зеркало `BuildServiceCalculationContextService`, но
  `build(period, employeeId, rules)` берёт третьим параметром правила схемы — `categoryDescendantFolderIds`
  зависит от `category` конкретных правил `ProductSold`/`UsedProductSold`), собственный
  `PeriodCalculationOrchestrator`/`rule-breakdown.builder`/`to-salary-report-rules.ts`.
- Расчётный период (`GET|POST /v1/shop/accounting/period/*`), документ начисления
  (`ShopSalaryAccrual`, `GET .../salary_accrual/*`) и отчёт по зарплате
  (`GET /v1/shop/accounting/salary_report/{employee,department}/:id/:period`) — **все** независимые
  от `service` классы: `close`/`reopen`/`recalculate`/`get` обслуживают собственные
  `Close`/`Reopen`/`RecalculateShopAccountingPeriodHandler`/`GetShopAccountingPeriodService`
  (`docs/service-shop-boundary-violations-fix`, Фазы 5–6 — до этого `get`/`reopen`/`recalculate`
  действительно переиспользовали generic-по-`direction` классы `service`, но это было заменено на
  независимую реализацию), отчёт по зарплате — `GetShopEmployeeSalaryReportService`/
  `GetShopDepartmentSalaryReportService` (ответ контракта односторонний, не объединяет `service`/
  `shop` в одном вызове). `ShopAccountingModule` использует собственные, отдельно именованные
  DI-токены (`SHOP_ACCOUNTING_PERIOD_REPOSITORY`/`SHOP_ACCOUNTING_PERIOD_SNAPSHOT`/
  `SHOP_ACCOUNTING_CALCULATION_CACHE`/`SHOP_SALARY_ACCRUAL_REPOSITORY`/`SHOP_SALES_PLAN_REPOSITORY`) —
  не переиспользует токены `service` даже под тем же именем; `AccountingModule` направления `service`
  `ShopAccountingModule` не импортирует.
- **Выплата начисленной зарплаты через кассу** (`cashbox-payout`: `create-payout`/
  `create-payout-batch`/`delete-payout`, конфигурация кассы, кассовый документ ERP) — реализована, но
  сознательно не описана в спеке ниже (см. Purpose спека и design.md соответствующего change): нюанс
  интеграции (поле `agent` кассового документа) не проверен на проде.

Бизнес-правила (мотивационная схема, формулы правил, жизненный цикл периода, документ начисления,
отчёты) — [`openspec/specs/shop/accounting/spec.md`](../../../../openspec/specs/shop/accounting/spec.md).

## Целевой набор модулей домена

Помимо `accounting` и `sales` (частично реализованы, см. выше), для `shop` планируются:

- **`purchasing`** — закупки товара у поставщиков. Не существует.
- **`logistics`** — логистика (доставка товара, перемещения между складами/точками). Не существует.
- **`warehouse`** — склад/остатки товаров. Частично реализован: `GET /shop/warehouse/catalog` отдаёт
  дерево категорий каталога (`GetCatalogService` строит его из уже синхронизированной
  `MoySkladProductFolder`, без нового синка) — бизнес-правила см.
  [`openspec/specs/shop/warehouse/spec.md`](../../../../openspec/specs/shop/warehouse/spec.md).
  Остатки и резервы товара этот модуль не покрывает.

`marketing` уже существует (`modules/marketing/pricing`, Фаза 8–10
`docs/todo-modules-ddd-refactoring`) — импорт закупочных цен из XLSX-прайса поставщика
(`POST /v1/shop/marketing/pricing/import-costs` + статус/SSE), см. `ENDPOINTS.md`; бизнес-правила
пайплайна импорта — [`openspec/specs/shop/marketing/spec.md`](../../../../openspec/specs/shop/marketing/spec.md).
Остальная часть маркетинга (источники обращений, кампании и их эффективность) в этом модуле пока не
покрыта.

Именование модулей — короткое существительное на английском, без домена в названии (не
`shop-warehouse`): домен и так задаёт контекст через путь `domains/shop/modules/*`. Для "склада"
используем `warehouse`, а не `store` — `store` в этом проекте легко спутать с самим доменом `shop`
(розничный магазин), поэтому его в качестве имени модуля избегаем. Для "закупок" — `purchasing`, а
не `procurement`: короче и симметрично уже используемому в `service` `sales`.

## Функциональность домена, ещё не перенесённая в `domains/shop`

Легаси `TODO/priceMonitoring` (обновление себестоимости товаров в МойСклад из прайсов поставщиков)
полностью перенесён в `modules/marketing/pricing` (Фазы 8–10 `docs/todo-modules-ddd-refactoring`) и
удалён — см. выше.

- Розничная аналитика (свой аналог `modules/reports` из домена `service`) для `shop` пока не
  существует ни в каком виде. При появлении такого функционала заводить его по DDD-слоям
  (`domain`/`application`/`infrastructure`/`interface`), описанным в `backend/CLAUDE.md`.

## Данные и тесты

- Prisma-схема: `prisma/schema/moySklad.prisma` (собственные таблицы `moySklad*`, включая поля
  закупщиков `onlinePurchaserId`/`offlinePurchaserId` на `moySkladDemandPosition` и `pathName`-индекс
  (`text_pattern_ops`) на `moySkladProductFolder`) и `prisma/schema/sales.prisma`
  (`SalesPlan`/`SalesPlanTemplate`, общие с `service` через поле `direction`).
- Тесты интеграций: `integrations/moySklad/moysklad.service.spec.ts`. `sync/moySklad` тестами
  покрыт частично (`moysklad-sync.mappers.spec.ts`, `product-folder-tree.service.spec.ts`,
  `resolve-purchaser-identity.spec.ts`); сам `MoySkladSyncService` — нет. `modules/sales`
  (`GetShopSalesPerformanceService`) и весь `modules/accounting` (domain-слой правил,
  `role-source`, `money`, `float-percent`, `salary-rule-registry`, фабрика; и с Фазы 13.5 —
  persistence/application/interface слой: мапперы, репозитории, CQRS-хендлеры,
  `BuildShopCalculationContextService`) покрыты юнит-тестами. Отчёт по зарплате сотрудника
  (`GetShopEmployeeSalaryReportService`) — строго однонаправленный, ответ не объединяет `service` и
  `shop` (см. "Отчёты по зарплате" выше); e2e-покрытие —
  `interface/http-controllers/get-employee-salary-report.e2e.spec.ts` в этом же модуле,
  зеркало одноимённого файла в `domains/service/modules/accounting/interface/http-controllers/`.
  Оба файла используют один и тот же `employeeId`, но независимые in-memory фейки — тем самым
  проверяют инвариант "сотрудник существует в обеих ERP одновременно, каждый эндпоинт видит только
  свой срез" двумя раздельными e2e вместо одного объединённого (существовавшего до Фазы 4 разбора
  `shop-report-integration.e2e.spec.ts`, см. `docs/payroll/phase-13.5-shop-report-integration.md`).