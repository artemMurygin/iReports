# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Домен **`shop`** — розничная продажа новой техники Apple и аксессуаров конечным клиентам (см.
[корневой CLAUDE.md](../../../../CLAUDE.md) и [backend/CLAUDE.md](../../../CLAUDE.md) для общей
картины и слоистого DDD-паттерна модулей). ERP-система направления — **МойСклад (MoySklad)**.

`shop` и `service` — параллельные бизнес-направления с похожим набором бизнес-процессов; `shop`
зеркалирует структуру `service` (см. `domains/service/CLAUDE.md`), но с самостоятельной, независимой
реализацией — общий код в основном ограничен `src/shared/*` и несколькими Prisma-моделями с
дискриминатором `direction` (`SalesPlan`/`SalesPlanTemplate`/`TaskCompletion`). Единственное осознанное
исключение из «независимого доменного кода» — CRUD плана и шаблона плана продаж в `modules/sales`
(см. ниже): HTTP-контроллеры `shop` напрямую диспатчат те же классы команд из
`domains/service/modules/sales/application/command/*` через общий `CommandBus`, подставляя
`direction: 'shop'` сами — независимы только эндпоинты (`/v1/shop/sales/plan*`), а не бизнес-логика.
`modules/accounting` от этого исключения свободен и полностью независим от одноимённого модуля
`service`. Домен уже вырос из
состояния «только интеграция и синк» — `modules/accounting` и `modules/sales` частично реализованы
(Фазы 10–13, см. `docs/payroll/plan-payroll-calculation.md` в корне репозитория), но не «планировались
на будущее» полностью — часть слоёв всё ещё сознательно отсутствует, см. ниже.

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
(`prisma/schema/moySklad.prisma`). Как и в `service`, порядок важен: категории товаров —
топологическая сортировка родитель→потомок (`topoSortFolders`) перед upsert.

`extractIdFromHref` (`moysklad-sync.mappers.ts`) — сквозной хелпер: API МойСклад отдаёт связи
(сотрудник, контрагент, склад, статус...) как `{ meta: { href } }`, а не голым id, поэтому id
приходится вытаскивать из URL почти на каждом маппинге.

Основной объект синхронизации — **отгрузки (demands)**, ключевая сущность для аналитики продаж
магазина:

- `uploadDemand` пишет шапку отгрузки (`moySkladDemand`) и её позиции (`moySkladDemandPosition`) в
  одной Prisma-транзакции, предварительно удаляя старые позиции (`deleteMany` + `createMany`, не
  diff/upsert по позициям).
- `ONLINE_MANAGER_ATTR_ID` — id кастомного атрибута в МойСклад, которым размечен
  онлайн-менеджер отгрузки (в отличие от `owner` — offline-менеджера); без этого атрибута
  `onlineManagerId` будет `null`.
- **Товары-модификации (`variant`)** не приходят в `/entity/product` и никогда не будут докатаны
  обычным `uploadProducts()` — если позиция отгрузки ссылается на неизвестный `variant`, для него
  на лету создаётся placeholder-запись в `moySkladProduct`, **наследующая `folderId` от
  родительского товара** (см. комментарий в `uploadDemand`). Это осознанное решение: без
  унаследованной категории такой товар навсегда останется без `folderId` и будет выпадать из
  отчётов, отфильтрованных по категории — не убирать это наследование при рефакторинге.
- Услуги (`service`) в позициях отгрузки, которых ещё нет в `moySkladService`, создаются аналогично
  через `createMany({ skipDuplicates: true })`.
- **Закупщики БУ техники и доп. поля (Фаза 10)** — `products.schema.ts` теперь читает `attributes`
  товара (не только `demands.schema.ts`, как раньше); `extractPurchaserExternalId`
  (`moysklad-sync.mappers.ts`) достаёт значения кастомных доп. полей `ONLINE_PURCHASER`/
  `OFFLINE_PURCHASER` из позиции отгрузки и резолвит их в `EmployeeIdentity` тем же механизмом, что
  строковое поле «онлайн-менеджер» RemOnline у `service`. `onlinePurchaserId`/`offlinePurchaserId`
  пишутся на уровне `moySkladDemandPosition` (закупщик свой у каждого устройства, а не один на
  отгрузку — в одном чеке может быть два БУ-айфона от разных закупщиков).
- **Дерево категорий (Фаза 10)** — `ProductFolderTreeService`
  (`sync/moySklad/product-folder-tree.service.ts`) раскрывает выбранную категорию
  (`MoySkladProductFolder`) до всех потомков одним запросом `pathName LIKE 'root.pathName/%'` по
  индексу `@@index([pathName], ops: text_pattern_ops)`, а не рекурсивным обходом `parentId` — дерево
  пополняется синком без ограничения глубины, обход в память или O(глубина) запросов деградировал бы
  с ростом справочника. Живёт в `sync/`, а не в `modules/accounting`, потому что это чистый
  Prisma-доступ к `moySklad*`-таблицам без бизнес-логики правил.

`MoySkladSyncCron` (`@ProdCron(CronExpression.EVERY_5_MINUTES)`) синкает через крон **только**
`uploadUpdatedDemands` — тот же паттерн `failedSince`-checkpoint при ошибке, что у `RoappSyncCron` в
домене `service` (см. `backend/src/domains/service/CLAUDE.md`). Остальные методы сервиса
(`uploadEmployees`, `uploadProductFolders`, `uploadProducts`, `uploadServices`) в крон не
включены — это ручные/разовые операции (`npm run initial`).

### `modules/sales` — SalesPerformance магазина (Фаза 11)

Зеркало `SalesPerformance`-среза `domains/service/modules/sales`, и, с Фазы 13.5, **план и шаблон
плана продаж для `shop` тоже обслуживаются собственными эндпоинтами** этого модуля
(`POST|GET|PATCH|DELETE /v1/shop/sales/plan`, `GET|PUT /v1/shop/sales/plan_template`,
`POST /v1/shop/sales/plan/approve`, см. `interface/http-controllers/*-shop-sales-plan*.http.controller.ts`
и `shopSalesPlanRoot`/`shopSalesPlanTemplateRoot` в `config/app.routes.ts`) — независимые от
`domains/service/modules/sales` по HTTP (свой путь, свой контроллер), но не по бизнес-логике:
`SalesPlan`/`SalesPlanTemplate` — общие Prisma-модели с полем `direction` на каждой строке, без
ERP-специфичной логики, поэтому контроллеры `shop` не дублируют CRUD, а диспатчат те же классы команд
(`CreateSalesPlanCommand` и т.д.) из `domains/service/modules/sales/application/command/*` через
общий на всё приложение `CommandBus` (обработчики регистрирует `SalesModule` направления service —
они генерик по `direction`, повторная регистрация здесь не нужна), сами подставляя
`direction: 'shop'` на сервере (не читая его из тела/query запроса) — клиент не может запросить чужое
направление через этот путь. `ListSalesPlansService`/`ListSalesPlanTemplatesService`/
`SALES_PLAN_REPOSITORY`/`SALES_PLAN_TEMPLATE_REPOSITORY`/`EnsureSalesPlansForPeriodService` — те же
классы направления `service`, но предоставлены `ShopSalesModule` отдельными экземплярами (Nest DI не
разделяет провайдеров между модулями без явного экспорта/импорта) — см. `ShopSalesModule`, комментарий
в `shop-sales.module.ts`.

Что у `shop` действительно самостоятельное:

- **`ShopSalesFact`/`ShopSalesPerformance`** — по `MoySkladDemand`/`MoySkladDemandPosition`;
  ⚠️ маржа берётся из готового `MoySkladDemandPosition.profit` (МойСклад сам считает его с учётом
  метода списания себестоимости), а НЕ пересчитывается как `turnover - cost`, в отличие от `service`.
  `quantity` — сумма `Float` (товар может быть весовым/дробным).
  `GetShopSalesPerformanceService` (единственная реализация `ShopSalesPerformanceReaderPort`) на
  каждый вызов пересчитывает факт и прогноз (`SalesPrognose.forPeriod()`, та же формула из
  `src/shared/domain/`, что у `service`) — ни факт, ни прогноз не персистятся.
- **Отдельный HTTP-эндпоинт** `GET /v1/shop/sales/salesPerformance/:period` вместо параметра
  `direction` у сервисного `/v1/service/sales/salesPerformance/:period` (см. обоснование раздельного
  пути в `config/app.routes.ts`) — сервисный роут жёстко читает RoApp и отклоняет любой `direction`,
  кроме `service`.
- **`ShopSalesPlanAutoCreationCron`** — собственный крон автосоздания плана первого числа поверх
  общего `EnsureSalesPlansForPeriodService` (переиспользуется как класс направления `service`, но
  предоставлен здесь отдельным экземпляром — Nest DI не разделяет провайдеров между модулями без
  явного экспорта/импорта), плюс ленивое достраивание при первом обращении к периоду — тот же
  механизм, что у `service` (Фаза 4).
- `SHOP_SALES_PERFORMANCE_READER` экспортируется как DI-порт для будущего `modules/accounting`
  (`ProductSoldEntity`/`FloatPercent` магазина уже принимают его через `context.salesPerformance`).

### `modules/accounting` — зарплатные правила магазина (Фазы 12–13)

Собственный реестр (`shopSalaryRuleRegistry`) и фабрика (`ShopSalaryRuleFactory`) правил, независимые
от одноимённого модуля `domains/service/modules/accounting` — ни один класс сервисного `accounting`
здесь не импортируется (в т.ч. `domain/services/shop-role-source.ts`, `money.ts`, `float-percent.ts`
— зеркала, но отдельные файлы). Четыре типа правил:

- **`PayPerHourEntity`** — почасовая оплата, тот же источник часов, что у `service`: общая модель
  `EmployeeHoursEntry` (без направления в самой сущности — источник данных общий).
- **`ProductSoldEntity`** — вознаграждение за проданный товар в категории: роль `ONLINE_MANAGER`/
  `OFFLINE_MANAGER` (уровень **отгрузки**, `MoySkladDemand.onlineManagerId`/`offlineManagerId`),
  `award` `Fixed`/`FixedPercent`/`FloatPercent`, `salaryBasis` `REVENUE` (`sum`)/`MARGIN` (`profit`) —
  `SALARY_MINUS_ENGINEER_SALARY` в магазине не существует. Категория — обязательная часть правила
  (пара «категория × награда», `null` = все товары), раскрывается до потомков через
  `ProductFolderTreeService.resolveDescendantFolderIds` заранее application-слоем
  (`erpData.categoryDescendantFolderIds`), правило только сверяет `folderId` позиции — при
  отсутствующем раскрытии контекста **fail closed** (лучше не начислить, чем начислить по чужой
  категории). `Fixed` считается по сумме `quantity` (а не числу позиций) — товар может быть
  дробным/весовым. `FloatPercent` берёт `context.salesPerformance` **по СВОЕЙ категории**
  (`docs/shop-sales-performance-by-category`, Фаза 2) — с тех пор как в `shop` появился факт продаж
  по категории (Фаза 1 того же плана, `ShopSalesFactErpAggregate.category`/
  `MoySkladSalesFactSourceRepository.aggregate`), `CalculationContext.salesPerformance` больше не
  единственное значение на отдел, а карта `category → percentCompletion`
  (`ShopSalesPerformanceByCategory`, ключ `null` = «весь отдел») — `BuildShopCalculationContextService`
  резолвит её через `ShopSalesPerformanceReaderPort.findForScope(period, department, category)` по
  каждой уникальной `category` правил `ProductSold`/`UsedProductSold` схемы сотрудника. Правило читает
  запись по `this.props.config.category`; **fail closed**, если для этой категории в карте нет
  расчёта (нет плана/факта по scope) — вознаграждение не начисляется, тот же принцип, что и у
  раскрытия дерева категорий выше. `TaskCompletedShopEntity.FloatPercent` категории не имеет вовсе —
  всегда читает запись «весь отдел» (`category: null`) и по-прежнему бросает
  `ShopSalesPerformanceRequiredException`, если её нет. `category` у `ProductSold` и у `SalesPlan`
  теперь одного типа (`string | null`, для `shop` — UUID папки МойСклад, `MoySkladProductFolder.id`),
  но это по-прежнему две независимые системы без фактической ссылочной связи/валидации между ними.
- **`UsedProductSoldEntity`** (Фаза 13) — вознаграждение закупщику БУ техники за **продажу**
  выкупленного им устройства (не за сам выкуп): роль `ONLINE_PURCHASER`/`OFFLINE_PURCHASER` (уровень
  **товарной позиции**, `MoySkladDemandPosition.onlinePurchaserId`/`offlinePurchaserId`), тот же
  источник данных `erpData.productSoldItems`, что у `ProductSoldEntity` (не отдельный) — момент
  начисления становится «продажей», а не «выкупом» автоматически, потому что application-слой уже
  отфильтровал позиции по `MoySkladDemand.moment` своей отгрузки внутри периода: невыкупленный или
  ещё не проданный остаток в выборку не попадает вообще. `award` только `Fixed`/`FixedPercent`, без
  `FloatPercent` — вознаграждение закупщика не привязано к выполнению плана продаж. Необязательная
  категория (та же логика раскрытия дерева и fail closed, что у `ProductSoldEntity`).
- **`TaskCompletedEntity`** (Фаза 13) — `Fixed`/`FloatPercent`, использует ту же временную Prisma-
  модель `TaskCompletion`, что и одноимённое правило `service` (различаются полем
  `TaskCompletion.direction`, дефолт `'service'`) — с Фазы 13.5 у `shop` есть собственный CQRS-вход
  для записи задач магазина (`ShopTaskCompletion`, см. ниже), пишущий в ту же таблицу с
  `direction: 'shop'`.
- Ролей инженера в `shop` нет. Дедупликация «правило × позиция/источник» — внутри каждого правила
  независимо (`dedupeByPosition`); вырожденный случай «продавец и закупщик — один сотрудник» не
  считается двойным начислением — `ProductSold` и `UsedProductSold` разные правила, начисляют
  независимо.

**Персистентность и оркестратор (Фаза 13.5, см. `docs/payroll/phase-13.5-shop-report-integration.md`)**:
пробел, ранее задокументированный здесь (только domain-слой правил + `GET
/v1/shop/accounting/salary_role_types`, без персистентности и без оркестратора расчёта из БД), закрыт.
Независимая (не переиспользующая классы `service`) реализация: `ShopSalaryRuleMapper`/`schema`/
`Repository`, `ShopMotivationSchema` (сущность + `ShopMotivationSchemaMapper`/`Repository`, включая
`findIdByTarget` — защита от дублирования строки `MotivationSchema` для сотрудника с идентичностями в
обеих ERP, у неё нет `direction`, ключ только `(targetType, targetId)`), `ShopTaskCompletion`
(сущность + mapper/repository, пишет в общую таблицу `TaskCompletion` с `direction: 'shop'`),
`BuildShopCalculationContextService` (`application/services/`, зеркало
`BuildServiceCalculationContextService` — но `build(period, employeeId, rules)` берёт третьим
параметром правила схемы, так как `categoryDescendantFolderIds` зависит от `category` конкретных
правил `ProductSold`/`UsedProductSold`), собственный `PeriodCalculationOrchestrator`/
`rule-breakdown.builder`/`to-shop-salary-report-rules.ts`. HTTP-запись: `POST
/v1/shop/accounting/motivation-schema` (find-or-create по `findIdByTarget`), `POST|GET
/v1/shop/accounting/task_completions`,
`POST /v1/shop/accounting/task_completions/:id/{confirm,reject}`,
`DELETE /v1/shop/accounting/task_completions/:id` (DTO переиспользуют направление-агностичные Zod-схемы
`TaskCompletion` из `ireports-contracts`, не бизнес-код).

Расчётный период (`GET|POST /v1/shop/accounting/period/*`) и отчёт по зарплате
(`GET /v1/shop/accounting/salary_report/{employee,department}/:id/:period`) — независимые от
`service` эндпоинты (Фазы 3–4, см. `domains/service/CLAUDE.md`, разделы «Расчётный период» и
«Отчёты»): `close` обслуживает собственный `CloseShopAccountingPeriodHandler`
(`domains/shop/modules/accounting/application/command/`), `get`/`reopen`/`recalculate` переиспользуют
generic-по-`direction` `GetAccountingPeriodService`/`ReopenAccountingPeriodCommand`/
`RecalculateAccountingPeriodCommand` сервисного `accounting` напрямую (без своих классов — команда/
хендлер уже не завязаны на конкретное направление), а отчёт по зарплате — собственные, строго
однонаправленные `GetShopEmployeeSalaryReportService`/`GetShopDepartmentSalaryReportService` (ответ
контракта односторонний, не объединяет `service`/`shop` в одном вызове, в отличие от того, как было
устроено до Фазы 4). `ShopAccountingModule` заводит собственные экземпляры инфраструктурных токенов
сервисного `accounting` (`ACCOUNTING_PERIOD_REPOSITORY`/`ACCOUNTING_PERIOD_SNAPSHOT`/
`ACCOUNTING_CALCULATION_CACHE`/`SALES_PLAN_REPOSITORY`) под теми же именами — тот же приём, что уже
применён в `ShopSalesModule` для `SALES_PLAN_REPOSITORY`/`SALES_PLAN_TEMPLATE_REPOSITORY`; сервисный
`AccountingModule` `ShopAccountingModule` больше не импортирует (кросс-доменная связь на уровне Nest DI
между `domains/service` и `domains/shop` в `accounting` полностью устранена, см.
`domains/service/CLAUDE.md`).

## Целевой набор модулей домена

Помимо `accounting` и `sales` (частично реализованы, см. выше), для `shop` планируются:

- **`purchasing`** — закупки товара у поставщиков. Не существует.
- **`logistics`** — логистика (доставка товара, перемещения между складами/точками). Не существует.
- **`warehouse`** — склад/остатки товаров. Не существует.

`marketing` уже существует (`modules/marketing/pricing`, Фаза 8–10
`docs/todo-modules-ddd-refactoring`) — импорт закупочных цен из XLSX-прайса поставщика
(`POST /v1/shop/marketing/pricing/import-costs` + статус/SSE), см. `ENDPOINTS.md`. Остальная часть
маркетинга (источники обращений, кампании и их эффективность) в этом модуле пока не покрыта.

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
  (`text_pattern_ops`) на `moySkladProductFolder`), `prisma/schema/sales.prisma`
  (`SalesPlan`/`SalesPlanTemplate`, общие с `service` через поле `direction`) и
  `prisma/schema/salary.prisma` (`TaskCompletion`, тоже общая с `service` через `direction`).
- Тесты интеграций: `integrations/moySklad/moysklad.service.spec.ts`. `sync/moySklad` тестами
  покрыт частично (`moysklad-sync.mappers.spec.ts`, `product-folder-tree.service.spec.ts`,
  `resolve-purchaser-identity.spec.ts`); сам `MoySkladSyncService` — нет. `modules/sales`
  (`GetShopSalesPerformanceService`) и весь `modules/accounting` (domain-слой правил,
  `shop-role-source`, `money`, `float-percent`, `salary-rule-registry`, фабрика; и с Фазы 13.5 —
  persistence/application/interface слой: мапперы, репозитории, CQRS-хендлеры,
  `BuildShopCalculationContextService`) покрыты юнит-тестами. Отчёт по зарплате сотрудника
  (`GetShopEmployeeSalaryReportService`) — строго однонаправленный, ответ не объединяет `service` и
  `shop` (см. "Отчёты по зарплате" выше); e2e-покрытие —
  `interface/http-controllers/get-shop-employee-salary-report.e2e.spec.ts` в этом же модуле,
  зеркало одноимённого файла в `domains/service/modules/accounting/interface/http-controllers/`.
  Оба файла используют один и тот же `employeeId`, но независимые in-memory фейки — тем самым
  проверяют инвариант "сотрудник существует в обеих ERP одновременно, каждый эндпоинт видит только
  свой срез" двумя раздельными e2e вместо одного объединённого (существовавшего до Фазы 4 разбора
  `shop-report-integration.e2e.spec.ts`, см. `docs/payroll/phase-13.5-shop-report-integration.md`).