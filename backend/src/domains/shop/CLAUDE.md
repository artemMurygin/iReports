# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Домен **`shop`** — розничная продажа новой техники Apple и аксессуаров конечным клиентам (см.
[корневой CLAUDE.md](../../../../CLAUDE.md) и [backend/CLAUDE.md](../../../CLAUDE.md) для общей
картины и слоистого DDD-паттерна модулей). ERP-система направления — **МойСклад (MoySklad)**.

`shop` и `service` — параллельные бизнес-направления с похожим набором бизнес-процессов; `shop`
зеркалирует структуру `service` (см. `domains/service/CLAUDE.md`), но с самостоятельной, независимой
реализацией — общий только код на уровне `src/shared/*` и несколько Prisma-моделей с дискриминатором
`direction` (`SalesPlan`/`SalesPlanTemplate`/`TaskCompletion`), не доменный код. Домен уже вырос из
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
    └── sales/                — SalesPerformance (факт/прогноз по МойСклад, Фаза 11); план/шаблон
                                 плана переиспользуют CRUD-модуль sales домена service как есть
```

### `integrations/moySklad`

`MoyskladService` (поверх `MoyskladHttpService`) — набор `fetch*`-методов к API МойСклад:
сотрудники, папки товаров (`productFolders`), товары, услуги, контрагенты (`counterparties`),
заказы покупателей (`customerOrders`), отгрузки (`demands`). Постраничные выборки (папки, товары,
услуги, отгрузки) отдаются как `AsyncGenerator<T[]>` с `PAGE_LIMIT = 1000` — тот же паттерн, что у
`roapp` в домене `service`, итерировать через `for await`.

В отличие от `service`, здесь **нет** абстракции вроде `roapp-gateway` — `MoySkladSyncService` и
`TODO/priceMonitoring` инжектят конкретный класс `MoyskladService` напрямую, не через порт/DI-токен.
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

Зеркало `SalesPerformance`-среза `domains/service/modules/sales`, но **план и шаблон плана продаж
для `shop` собственного CRUD не имеют** — их обслуживают общие CRUD-эндпоинты
`domains/service/modules/sales` (`POST|GET|PATCH|DELETE /v1/sales/plan`,
`GET|PUT /v1/sales/plan_template`, `POST /v1/sales/plan/approve`): `SalesPlan`/`SalesPlanTemplate` —
общие Prisma-модели с полем `direction` на каждой строке, без ERP-специфичной логики, поэтому
дублировать их в `shop` не имеет смысла (см. `ShopSalesModule`, комментарий в `shop-sales.module.ts`).

Что у `shop` действительно самостоятельное:

- **`ShopSalesFact`/`ShopSalesPerformance`** — по `MoySkladDemand`/`MoySkladDemandPosition`;
  ⚠️ маржа берётся из готового `MoySkladDemandPosition.profit` (МойСклад сам считает его с учётом
  метода списания себестоимости), а НЕ пересчитывается как `turnover - cost`, в отличие от `service`.
  `quantity` — сумма `Float` (товар может быть весовым/дробным).
  `GetShopSalesPerformanceService` (единственная реализация `ShopSalesPerformanceReaderPort`) на
  каждый вызов пересчитывает факт и прогноз (`SalesPrognose.forPeriod()`, та же формула из
  `src/shared/domain/`, что у `service`) — ни факт, ни прогноз не персистятся.
- **Отдельный HTTP-эндпоинт** `GET /v1/sales/salesPerformance/shop/:period` вместо параметра
  `direction` у общего `/v1/sales/salesPerformance/:period` (см. обоснование раздельного пути в
  `config/app.routes.ts`) — общий роут жёстко читает RoApp и отклоняет любой `direction`, кроме
  `service`.
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
  дробным/весовым. `FloatPercent` берёт `context.salesPerformance` **по отделу целиком**, не по
  категории правила — план/факт по категории в `shop` пока не реализован, категория `ProductSold`
  (папка МойСклад) и категория `SalesPlan` (числовой id) сейчас никак не связаны между собой.
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
/shop/accounting/salary_role_types`, без персистентности и без оркестратора расчёта из БД), закрыт.
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
/shop/accounting/motivation-schema` (find-or-create по `findIdByTarget`), `POST|GET
/shop/accounting/task_completions`, `POST /shop/accounting/task_completions/:id/{confirm,reject}`,
`DELETE /shop/accounting/task_completions/:id` (DTO переиспользуют направление-агностичные Zod-схемы
`TaskCompletion` из `ireports-contracts`, не бизнес-код). `ShopAccountingModule` экспортирует
`SHOP_MOTIVATION_SCHEMA_REPOSITORY`/`BuildShopCalculationContextService`/`SHOP_CALCULATION_DATA` —
единственная точка связи с `domains/service` на уровне Nest DI: сервисный `AccountingModule`
импортирует `ShopAccountingModule` ради этих токенов (не ради переиспользования классов), чтобы
`GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService`/`CloseAccountingPeriodHandler`
стали direction-aware и обслуживали оба направления. Расчётный период, отчёт по зарплате и CRUD
правил для `shop` теперь используют этот же контур, что и `service` — см.
`domains/service/CLAUDE.md`, разделы «Расчётный период» и «Отчёты».

## Целевой набор модулей домена

Помимо `accounting` и `sales` (частично реализованы, см. выше), для `shop` планируются:

- **`purchasing`** — закупки товара у поставщиков. Не существует.
- **`logistics`** — логистика (доставка товара, перемещения между складами/точками). Не существует.
- **`marketing`** — маркетинг (источники обращений, кампании и их эффективность). Не существует.
- **`warehouse`** — склад/остатки товаров. Не существует.

Именование модулей — короткое существительное на английском, без домена в названии (не
`shop-warehouse`): домен и так задаёт контекст через путь `domains/shop/modules/*`. Для "склада"
используем `warehouse`, а не `store` — `store` в этом проекте легко спутать с самим доменом `shop`
(розничный магазин), поэтому его в качестве имени модуля избегаем. Для "закупок" — `purchasing`, а
не `procurement`: короче и симметрично уже используемому в `service` `sales`.

## Функциональность домена, ещё не перенесённая в `domains/shop`

- **`TODO/priceMonitoring`**, эндпоинт `/price-monitoring/update-shop-products-costs` — обновляет
  себестоимость товаров в МойСклад (`moysklad.batchUpdateProducts`), сверяясь с прайсами поставщиков
  через Excel/AI-парсинг (`src/integrations/ai`). Этот же модуль обслуживает и домен `service`
  (`update-service-price`) — единая точка входа для обеих ERP, физически не принадлежит ни одному
  домену.
- Розничная аналитика (свой аналог `TODO/reports` из домена `service`) для `shop` пока не
  существует ни в каком виде. При появлении такого функционала заводить его по DDD-слоям
  (`domain`/`application`/`infrastructure`/`interface`), описанным в `backend/CLAUDE.md`, а не как
  плоский `TODO`-модуль.

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
  `BuildShopCalculationContextService`) покрыты юнит-тестами; сквозной e2e-сценарий «сотрудник в
  обеих ERP» — в `domains/service/modules/accounting/interface/http-controllers/
  shop-report-integration.e2e.spec.ts` (доменный e2e для этого расчёта живёт на стороне `service`,
  так как это единственная точка HTTP-входа для объединённого отчёта по обоим направлениям).