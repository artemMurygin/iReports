# Эндпоинты backend (backend/src)

Все пути указаны от корня, глобальный префикс не задан.

## domains/service/modules/accounting (`/v1/service/accounting`, `/v1/service/motivation-schema`)
- `GET /v1/service/accounting/salary_report/employee/:id/:period` — отчёт по зарплате сотрудника направления `service` за период (`period` — `YYYY-MM`). С Фазы 4 (см. `docs/service-shop-route-split`) ответ строго однонаправленный — один отчёт направления `service`: `{ period, direction: 'service', isClosed, total: { fact, prognose }, rules, salesPerformance, isPlanApproved }`, без `directions[]`/`grandTotal` (аналог для `shop` — независимый `GET /v1/shop/accounting/salary_report/employee/:id/:period`, см. ниже, не параметр этого же эндпоинта). Пара «факт/прогноз» — режим расчёта `FACT`/`PROGNOSE` (Фаза 9: прогноз берёт `SalesPrognose.percentCompletion` вместо `SalesFact.percentCompletion`, личная база сотрудника не экстраполируется), для `FloatPercent` — `floatPercent.{fact,prognose}.{currentThreshold,nextThreshold,diffToNext}`. Открытый период — ленивый кэш по штампу синхронизации/версии схемы/плана продаж (Фаза 6, ключ `(direction, period, employeeId)`); закрытый — отдаётся из неизменяемого снапшота
- `GET /v1/service/accounting/salary_report/department/:id/:period` — отчёт по зарплатам отдела направления `service` за период (Фаза 9): тот же расчёт, что и у отчёта сотрудника, агрегированный по каждому сотруднику отдела, строго однонаправленный (`employees[].rules` — только строки `service`, `isClosed`/`total.prognose` — статус периода только этого направления). Контекст ERP-данных/`SalesPerformance`/схем/идентичностей/часов собирается один раз на весь отдел, без N+1 запросов на сотрудника
- `POST /v1/service/motivation-schema` — создать мотивационную схему (цель + набор зарплатных правил, `direction: 'service'` — правила пишутся с этим дискриминатором в `salary_rules`). Find-or-create по естественному ключу `(targetType, targetId)` строки `motivation_schemas` (Фаза 13.5, issue #57) — если у сотрудника уже есть строка схемы, созданная с shop-стороны (`POST /v1/shop/accounting/motivation-schema` ниже, тот же `targetId`), вторая строка не создаётся, новые правила добавляются к существующей схеме; так сотрудник с идентичностями в обеих ERP получает ровно одну строку `motivation_schemas` независимо от порядка обращений с обеих сторон. Поведение этого эндпоинта не изменилось фазой "Редактирование зарплатных схем" ниже — find-or-create остался прежним
- Просмотр/редактирование зарплатных схем (страница списка/деталей, Фаза "Редактирование зарплатных схем") — направление схемы НЕ хранимое поле, а следствие того, что у строки `motivation_schemas` есть ≥1 правило `direction='service'`; строка с 0 такими правилами (все правила принадлежат `shop`-стороне той же схемы) для этих трёх эндпоинтов не существует:
  - `GET /v1/service/motivation-schema` — список схем сервиса. Query: `targetType?` (`Department`/`Employee`), `targetId?`, `search?` (подстрока по `name`, без учёта регистра). Ответ — `MotivationSchemaListItem[]`: `{ id, name, direction: 'service', target: { type, id, name }, ruleCount, ruleTypes, updatedAt }`, `target.name` резолвится через `modules/directory` (`Неизвестно (id: N)`, если отдел/сотрудник не найден в справочнике), `ruleTypes` — уникальные типы правил схемы в порядке первого появления, `updatedAt = max(schema.updatedAt, ...rules[].updatedAt)`. Без пагинации/сортировки на бэкенде
  - `GET /v1/service/motivation-schema/:id` — полная схема со всеми правилами (`MotivationSchemaDetailResponse`: `{ id, name, direction: 'service', target, rules: SalaryRuleResponse[], updatedAt }`, каждое правило — `{ id, type, name, targetRole, config }`) — предзаполнение формы редактирования. `404`, если строки `motivation_schemas` нет ИЛИ у неё 0 правил `direction='service'`
  - `PATCH /v1/service/motivation-schema/:id` — переименовать схему и полностью заменить набор её правил направления `service` (`{ name, rules: SalaryRuleRequest[] }`, без `targetType`/`targetId` — цель схемы редактированием не меняется). Внутри одной транзакции: переименование → `deleteMany({ motivationSchemaId, direction: 'service' })` (не задевает правила `shop` той же строки) → пересоздание каждого правила из `rules` через тот же `CreateSalaryRuleCommand`, что и у `POST` выше (без diff отдельных правил — дельта вычисляется неявно, полная замена). `404` при тех же условиях, что и `GET .../motivation-schema/:id`. Ответ — `{ id }`
- Расчётный период (`AccountingPeriod`, Фаза 6, дополнено Фазой 13.5 и разделено по направлениям Фазой 3 — см. docs/payroll/plan-payroll-calculation.md и docs/service-shop-route-split) — сервис и магазин закрываются НЕЗАВИСИМЫМИ эндпоинтами без `:direction` в пути (свой `AccountingPeriod`/снапшот на каждое направление): закрытие `service` не трогает открытый период/снапшот `shop`, и наоборот. `close` обслуживают два независимых класса-хендлера (`CloseAccountingPeriodHandler` здесь и `CloseShopAccountingPeriodHandler` в `domains/shop/modules/accounting`, без общего кода/кросс-доменных импортов); `get`/`reopen`/`recalculate` — общие, generic-по-`direction` классы, переиспользуемые обоими доменами через один `CommandBus`. Эндпоинты без гарда (см. «неблокирующие вопросы» PRD, то же решение, что и у `sales`):
  - `GET /v1/service/accounting/period/:period` — статус периода направления `service`; для периода без записи в БД возвращает `status = OPEN`
  - `POST /v1/service/accounting/period/:period/close` — закрыть период (`{ closedBy }`): отклоняется (`409`) со списком строк в `metadata.rows`, если в плане продаж периода есть неутверждённые строки; при успехе сбрасывает кэш периода, создаёт неизменяемый снапшот по каждому сотруднику с личной мотивационной схемой (или схемой его отдела) и — в той же транзакции — документ начисления `SalaryAccrual` в статусе `DRAFT` на каждого сотрудника снапшота, включая нулевые суммы и уволенных (`isDismissed` по активности `BitrixEmployee` на момент закрытия); после коммита публикуется `SalaryAccrualDocumentsCreatedDomainEvent` (PRD 1 docs/payroll-closing-and-accrual)
  - `POST /v1/service/accounting/period/:period/reopen` — повторно открыть закрытый период (`{ confirm: true }`): если все документы начисления периода в `DRAFT` — удаляет документы и снапшот целиком; иначе `409` с перечнем документов не в `DRAFT` в `metadata.accruals` (`{ id, employeeId, status }[]`), ничего не удаляется
  - `POST /v1/service/accounting/period/:period/recalculate` — сбросить кэш открытого периода (действие «пересчитать» для руководителя); `204`, закрытый период — `409`
- Документы начисления зарплаты (`SalaryAccrual`, PRD 1 docs/payroll-closing-and-accrual, Фаза 1) — рождаются только закрытием периода (см. `close` выше), один документ на `(direction, period, employeeId)`; чтение, без гарда:
  - `GET /v1/service/accounting/salary_accruals?period=YYYY-MM` — список документов направления `service` за период: `{ direction, period, items: SalaryAccrual[], total }`, где `SalaryAccrual` — `{ id, direction, period, employeeId, employeeName, departmentId, status, isDismissed, total, linesCount, createdAt }` (`employeeName`/`departmentId` — из справочника Bitrix на чтении, `isDismissed` — зафиксирован в документе). До закрытия периода — пустой список; `period` обязателен (`400`)
  - `GET /v1/service/accounting/salary_accruals/:id` — карточка документа: то же + `lines: SalaryAccrualLine[]` — строка на каждое зарплатное правило снапшота (`ruleId, type, name, targetRole, salaryBasis, quantity, rate, amount, originalAmount, status, sources`); `404`, если документ не найден или принадлежит другому направлению
  - В ответе `GET .../salary_report/employee/:id/:period` появилось поле `accrualStatus` (`DRAFT | PARTIALLY_ACCRUED | ACCRUED | PAID | null`) — статус документа начисления сотрудника за закрытый период; `null` для открытого периода или если сотрудник в снапшот не попал
- Ручной ввод часов сотрудника за период (`EmployeeHoursEntry`, Фаза 7, см. docs/payroll/plan-payroll-calculation.md) — минимальный источник данных для `PayPerHour.calculate()` (полноценный график работы вне скоупа); эндпоинты без гарда, как и остальной `accounting`:
  - `POST /v1/service/accounting/employee_hours` — создать запись (`{ employeeId, period, hours }`); повтор на ту же пару `(employeeId, period)` отклоняется (`409`)
  - `PATCH /v1/service/accounting/employee_hours/:id` — изменить количество часов
  - `DELETE /v1/service/accounting/employee_hours/:id` — удалить запись
  - `GET /v1/service/accounting/employee_hours?period&employeeId` — записи за период (все сотрудники) или одна запись, если указан `employeeId`
- `GET /v1/service/accounting/salary_role_types` — типы зарплатных правил сервиса (`PayPerHour`, `ServiceCompleted`, `OrderPayed`, `TaskCompleted`) с перечнем допустимых `targetRole` для каждого (Фаза 8)
- Выполнение задачи сотрудником (`TaskCompletion`, Фаза 8, см. docs/payroll/plan-payroll-calculation.md) — временный внутренний двухступенчатый воркфлоу подтверждения без интеграции с Bitrix24 Tasks (синхронизация с реальными задачами запланирована отдельной фазой); эндпоинты без гарда, как и остальной `accounting`. `TaskCompletion.direction` (Фаза 13, дефолт `'service'`) — эти эндпоинты всегда пишут/читают `direction: 'service'`; направление `shop` пишет/читает ту же таблицу (`direction: 'shop'`) через собственный, независимый CQRS-вход `POST/GET /v1/shop/accounting/task_completions*` (Фаза 13.5, см. ниже) — ту же пару Zod-контрактов (`createTaskCompletionRequestSchema`/`confirmTaskCompletionRequestSchema`/…) переиспользует HTTP-DTO, а не бизнес-логика:
  - `POST /v1/service/accounting/task_completions` — сотрудник отмечает задачу выполненной (`{ employeeId, period, description, createdBy }`), сразу в статусе `PENDING_CONFIRMATION`
  - `POST /v1/service/accounting/task_completions/:id/confirm` — руководитель подтверждает (`{ confirmedBy }`) → только такие записи участвуют в расчёте `TaskCompleted.calculate()`
  - `POST /v1/service/accounting/task_completions/:id/reject` — руководитель отклоняет (`{ confirmedBy }`)
  - `DELETE /v1/service/accounting/task_completions/:id` — удалить запись
  - `GET /v1/service/accounting/task_completions?period&employeeId` — записи за период (все сотрудники) или одна запись, если указан `employeeId`

## modules/directory (`/v1/directory`)
Справочник отделов и сотрудников Bitrix24 (`BitrixDepartment`/`BitrixEmployee`, синхронизированные через
`sync/bitrix`) — Фаза 1 `docs/salary-schema-creation-ui/plan-salary-schema-creation-ui.md`. Питает селекты
«Отдел»/«Сотрудник» на Шаге 1 формы создания зарплатной схемы; до этого модуля справочник существовал
только в БД, наружу не отдавался. Модуль общий, не привязан к домену `service`/`shop` (тот же принцип,
что и `modules/employee-identity`), эндпоинты без гарда — тот же принцип, что и у остальных внутренних
read-only справочников (`deals.managers`, `shop.warehouse.catalog`).
- `GET /v1/directory/departments` — список отделов (`id`/`name`)
- `GET /v1/directory/employees?departmentId=` — список сотрудников (`id`/`name`/`departmentId`),
  `name` — `firstName + lastName`, собранные на бэкенде; `departmentId` — опциональный фильтр, без него
  отдаются сотрудники всех отделов

## modules/employee-identity (`/v1/employee-identity`)
Идентификация сотрудника между Bitrix24 / RemOnline / МойСклад (Фаза 2). Эндпоинты блока временно
открыты: `PortalAdminGuard` (заголовок `x-bitrix-auth` с access token текущего пользователя из
`BX24.getAuth()`) закомментирован на контроллерах по решению пользователя — страница управления
связями работает вне встроенного в Bitrix24 контекста и этот заголовок прислать не может. Сам гард
и `BitrixPortalAdminCheckService` остаются в `src/integrations/bitrix/auth` и могут быть возвращены;
как именно — см. комментарий в `create-employee-identity.http.controller.ts`.
- `GET /v1/employee-identity` — все связи разом (`EmployeeIdentityResponse[]`, отсортированы по
  `bitrixEmployeeId`, затем `createdAt`) — вход для экрана «сотрудники × их связи», чтобы не звать
  `GET /v1/employee-identity/employee/:employeeId` на каждого сотрудника (N+1)
- `POST /v1/employee-identity` — создать связь «сотрудник Bitrix × внешняя система × внешний идентификатор»
- `PATCH /v1/employee-identity/:id` — изменить тип идентификатора и/или внешний ID связи
- `DELETE /v1/employee-identity/:id` — удалить связь
- `GET /v1/employee-identity/employee/:employeeId` — связи конкретного сотрудника
- `GET /v1/employee-identity/unmatched` — сотрудники Bitrix без единой связи ни в одной системе

## domains/service/modules/sales (`/v1/service/sales/plan`, `/v1/service/sales/plan_template`, `/v1/service/sales/salesPerformance`)
План продаж (Фаза 3) — вход для всех процентных зарплатных правил. Модели (`SalesPlan`/
`SalesPlanTemplate`) общие для направлений `service`/`shop` (общая Prisma-схема с дискриминатором
`direction`), но с Фазы 2 (`docs/service-shop-route-split`) CRUD-эндпоинты — независимые наборы по
направлениям: `/v1/service/sales/plan*` здесь и `/v1/shop/sales/plan*` в `domains/shop/modules/sales`
(см. ниже) — оба тонкий HTTP-слой поверх одних и тех же классов команд этого модуля через общий
`CommandBus`, но `direction` подставляет сервер по тому, под каким путём пришёл запрос — клиент
больше не передаёт его в теле/query, и попытка изменить/удалить/утвердить строку чужого направления по
`id` отклоняется как «не найдено» (`404`), а не как ошибка доступа. Без модели прав в проекте
эндпоинты не закрыты гардом (в отличие от `employee-identity`, см. «неблокирующие вопросы» PRD).
- `POST /v1/service/sales/plan` — создать план месяца по отделу и, опционально, категории (`source = MANUAL`); тело — один объект плана или `{ items: [...] }` (batch на несколько отделов/категорий за один запрос, ответ зеркалит форму тела) — `direction` в теле не передаётся; повтор на ту же комбинацию `(department, category, period)` — как с уже существующей строкой направления `service`, так и внутри самого батча — отклоняется целиком, атомарно (`409`)
- `GET /v1/service/sales/plan?period` — план месяца направления `service`
- `PATCH /v1/service/sales/plan/:id` — изменить оборот/маржу; переводит строку в `source = MANUAL`, утверждённую строку возвращает в `status = CREATED`; `id` строки другого направления — `404`
- `DELETE /v1/service/sales/plan/:id` — удалить строку плана; `id` строки другого направления — `404`
- `POST /v1/service/sales/plan/approve` — утвердить построчно (`{ ids, approvedBy }`, весь запрос отклоняется `404`, если хотя бы один `id` принадлежит направлению `shop`, ни одна строка не утверждается) или весь месяц направления `service` (`{ period, approvedBy }`); уже утверждённые строки не трогает
- `GET /v1/service/sales/plan_template` — дефолтный шаблон плана направления `service` (оборот, маржа, процент роста) по отделам/категориям
- `PUT /v1/service/sales/plan_template` — upsert строки шаблона направления `service` по естественному ключу `(department, category)`
- `GET /v1/service/sales/salesPerformance/:period?direction` — план, факт и прогноз одним запросом по каждому отделу и категории направления за период (Фаза 5); факт и прогноз не персистятся, считаются заново на каждый запрос по данным ERP и текущему плану. Поддержан только `direction=service` (`400` для любого другого значения) — читатель этого эндпоинта жёстко привязан к RoApp/RemOnline; для `shop` см. отдельный эндпоинт `domains/shop/modules/sales` ниже
- `GET /v1/service/sales/funnel-report?from&to&sourceIds&managerIds&modelIds&stageIds&stageGroupIds` — отчёт по воронке сервисных сделок (Фаза 4 `docs/todo-modules-ddd-refactoring`, новый дом для legacy `GET /reports/service-funnel`): `{ KPI, deals }`, `deals` — та же форма, что у списка сделок выше; группировка этапов воронки — VO `FunnelStageMap`

## domains/service/modules/reports (`/v1/service/reports`)
Аналитика проданных услуг и справочник категорий услуг (Фаза 5 `docs/todo-modules-ddd-refactoring`) —
новый дом для legacy `GET /reports/services-analytics` и `GET /reports/service-categories`
(`src/TODO/reports`, удалён этой же фазой целиком). Источник данных — `roapp_service_orders`/
`roapp_service_categories`, к воронке сервисных сделок (`funnel-report` выше, `bitrix_deals`)
отношения не имеет — отдельный модуль, а не часть `modules/sales`.
- `GET /v1/service/reports/services?from&to&groupBy&categoryIds&serviceIds` — метрики по каждой
  проданной услуге за период (`totalCount`, `totalRevenue`, `totalProfit`, `totalEngineerBonus`,
  `avgServicePrice`, `avgOrderCheck` — `avgOrderCheck`/`totalRevenue`/`totalProfit` считаются по
  уникальным заказам, не по строкам услуг) + разбивка `breakdown` по периодам (`groupBy`: `day` (по
  умолчанию) / `week` / `month`)
- `GET /v1/service/reports/service-categories` — плоский список категорий услуг (`id`/`name`/
  `parentId`/`depth`), без параметров

Сделки Bitrix24 (`/v1/service/sales/deals*`, Фазы 1-2, docs/todo-modules-ddd-refactoring) — новый дом
для легаси `/deals*` (`backend/src/TODO/deals`, удалён): список сделок за диапазон дат создания и пять
read-only справочников. Диапазон дат валидируется доменным VO `DateRange`
(`src/shared/domain/date-range.value-object.ts`, инварианты «обе даты валидны», `from ≤ to`) —
невалидный ввод отклоняется `400`, как и раньше, но через `DomainExceptionFilter`, а не ручной
`BadRequestException`. Выборка менеджеров — один батч-запрос (`bitrixEmployee.findMany` с `id: { in }`),
а не `findFirst` на каждого менеджера, как было в легаси.
- `GET /v1/service/sales/deals?from&to` — список сделок за диапазон дат создания (`{ total, deals }`)
- `GET /v1/service/sales/deals/stages` — этапы сделок (`BitrixStage`, отсортированы по `sort`)
- `GET /v1/service/sales/deals/managers` — менеджеры, назначенные хотя бы на одну сделку
- `GET /v1/service/sales/deals/sources` — источники сделок (`BitrixLeadSources`)
- `GET /v1/service/sales/deals/stage-groups` — группы этапов (`{ id, name }`, distinct по сделочным `BitrixStage`)
- `GET /v1/service/sales/deals/models` — модели устройств сделок (`BitrixDeviceTypes`); путь `/models`
  сохранён как в легаси, хотя внутри — `getDeviceTypes()`

## domains/shop/modules/sales (`/v1/shop/sales/plan`, `/v1/shop/sales/plan_template`, `/v1/shop/sales/salesPerformance`)
SalesFact/SalesPrognose/SalesPerformance направления `shop` по данным МойСклад (Фаза 11, issue #54/#55)
— зеркало `GetSalesPerformanceService` направления `service`, отдельный эндпоинт вместо `direction` в
query у сервисного пути `/v1/service/sales/salesPerformance/:period` (см. обоснование в `config/app.routes.ts`).
С Фазы 2 (`docs/service-shop-route-split`) у `shop` есть и собственный независимый CRUD плана/шаблона
плана продаж — тонкий HTTP-слой поверх тех же классов команд, что и у `domains/service/modules/sales`
(общий `CommandBus`, `direction: 'shop'` подставляет контроллер, не тело/query запроса; см. пояснение
в секции `domains/service/modules/sales` выше и комментарий в `shop-sales.module.ts`). Автосоздание
плана — свой крон первого числа (`ShopSalesPlanAutoCreationCron`, `@ProdCron`) поверх общего
`EnsureSalesPlansForPeriodService`, плюс ленивое достраивание при первом обращении к периоду (тот же
механизм, что и у `service`).
- `POST /v1/shop/sales/plan` — создать план месяца по отделу и, опционально, категории направления `shop`; тело — один объект плана или `{ items: [...] }`, `direction` не передаётся; повтор на ту же комбинацию `(department, category, period)` направления `shop` — `409`
- `GET /v1/shop/sales/plan?period` — план месяца направления `shop`
- `PATCH /v1/shop/sales/plan/:id` — изменить оборот/маржу строки направления `shop`; `id` строки направления `service` — `404`
- `DELETE /v1/shop/sales/plan/:id` — удалить строку плана направления `shop`; `id` строки направления `service` — `404`
- `POST /v1/shop/sales/plan/approve` — утвердить построчно (`{ ids, approvedBy }`, весь запрос отклоняется `404`, если хотя бы один `id` принадлежит направлению `service`) или весь месяц направления `shop` (`{ period, approvedBy }`)
- `GET /v1/shop/sales/plan_template` — дефолтный шаблон плана направления `shop`
- `PUT /v1/shop/sales/plan_template` — upsert строки шаблона направления `shop` по естественному ключу `(department, category)`
- `GET /v1/shop/sales/salesPerformance/:period` — план, факт и прогноз одним запросом по каждому отделу направления `shop` за период; ⚠️ `fact.margin` — сумма `MoySkladDemandPosition.profit` по позициям отгрузок периода, а не `turnover - cost` (значение уже посчитано в МойСклад с учётом метода списания себестоимости); `quantity` — сумма `Float` (весовой/дробный товар)

## domains/shop/modules/accounting (`/v1/shop/accounting`)
Зарплатные правила, мотивационная схема, выполнение задач и расчёт магазина (Фазы 12/13/13.5,
issues #57-#66, см. docs/payroll/plan-payroll-calculation.md и
docs/payroll/phase-13.5-shop-report-integration.md) — собственный набор `domain`/`application`/
`infrastructure`/`interface`, независимый от одноимённого модуля `domains/service/modules/accounting`
(зеркальные, но раздельные классы — ни один класс сервисного `accounting` здесь не импортируется, см.
`backend/CLAUDE.md`). Четыре типа правил (свои реестр `shopSalaryRuleRegistry` и фабрика
`ShopSalaryRuleFactory`): `PayPerHour` (`hours × price`, источник часов — общий `EmployeeHoursEntry`),
`ProductSold` (награда `Fixed`/`FixedPercent`/`FloatPercent` за проданный товар в категории
`MoySkladProductFolder`, с раскрытием вложенных папок; база `REVENUE`/`MARGIN`, без
`SALARY_MINUS_ENGINEER_SALARY`), `UsedProductSold` (Фаза 13 — вознаграждение закупщику БУ техники за
**продажу** выкупленного им устройства, не за выкуп: тот же источник данных, что и `ProductSold`,
позиции периода отгрузки; `Fixed`/`FixedPercent`, без `FloatPercent`; необязательная категория) и
`TaskCompleted` (Фаза 13 — `Fixed`/`FloatPercent`, тот же временный источник данных, что у
одноимённого правила сервиса — общая таблица `TaskCompletion`, различаемая по полю
`TaskCompletion.direction`). Роли — `ONLINE_MANAGER`/`OFFLINE_MANAGER` (уровень отгрузки,
`MoySkladDemand`, используются `ProductSold`/`TaskCompleted`) и `ONLINE_PURCHASER`/
`OFFLINE_PURCHASER` (уровень товарной позиции, используются `UsedProductSold`); роли инженера нет.
Дедупликация «правило × позиция» — внутри каждого правила независимо; вырожденный случай «продавец и
закупщик — один сотрудник» не считается двойным начислением (`ProductSold` и `UsedProductSold` —
разные правила).

Персистентность мотивационной схемы/правила/задачи магазина и оркестратор, реально собирающий
`CalculationContext` из БД для направления `shop` (`BuildShopCalculationContextService`), реализованы
Фазой 13.5. Расчётный период и отчёт по зарплате разделены на независимые от `service` эндпоинты
Фазами 3–4 (`docs/service-shop-route-split`) — `close` обслуживает собственный
`CloseShopAccountingPeriodHandler`, `get`/`reopen`/`recalculate` переиспользуют generic-по-`direction`
классы сервисного `accounting` напрямую (без своих Command/Handler), а отчёт по зарплате —
собственные, строго однонаправленные `GetShopEmployeeSalaryReportService`/
`GetShopDepartmentSalaryReportService` (ответ не объединяется с `service` в одном вызове):
- `GET /v1/shop/accounting/period/:period` — статус периода направления `shop`; без записи в БД — `status = OPEN`
- `POST /v1/shop/accounting/period/:period/close` — закрыть период направления `shop` (`{ closedBy }`); `409` при неутверждённых строках плана продаж этого направления, иначе — сброс кэша, неизменяемый снапшот по каждому сотруднику с личной мотивационной схемой `shop` (или схемой отдела) и в той же транзакции документы начисления `SalaryAccrual` (`DRAFT`, включая нулевые и уволенных с `isDismissed`); после коммита — `SalaryAccrualDocumentsCreatedDomainEvent` направления `shop`. Реализовано отдельным `CloseShopAccountingPeriodHandler`, без общего кода с `service`
- `POST /v1/shop/accounting/period/:period/reopen` — повторно открыть закрытый период (`{ confirm: true }`): все документы начисления в `DRAFT` → удаляет документы и снапшот; иначе `409` с `metadata.accruals`
- `POST /v1/shop/accounting/period/:period/recalculate` — сбросить кэш открытого периода; `204`, закрытый период — `409`
- `GET /v1/shop/accounting/salary_accruals?period=YYYY-MM` — список документов начисления направления `shop` за период, та же форма, что у сервисного эквивалента (`{ direction: 'shop', period, items, total }`); закрытие `service` документов `shop` не создаёт
- `GET /v1/shop/accounting/salary_accruals/:id` — карточка документа начисления `shop` со строками; `404` для документа другого направления
- `GET /v1/shop/accounting/salary_report/employee/:id/:period` — отчёт по зарплате сотрудника направления `shop`, та же форма ответа, что у сервисного эквивалента (`{ period, direction: 'shop', isClosed, total, rules, salesPerformance, isPlanApproved, accrualStatus }`)
- `GET /v1/shop/accounting/salary_report/department/:id/:period` — отчёт по зарплатам отдела направления `shop`, `employees[].rules` — только строки `shop`

HTTP-запись мотивационной схемы/задач ниже. `MotivationSchema`/`SalaryRule` — та же Prisma-таблица, что и у
`service` (`motivation_schemas` без колонки `direction`, `salary_rules.direction = 'shop'`); find-or-
create по `(targetType, targetId)` в `CreateShopMotivationSchemaHandler` — зеркало сервисного
`CreateMotivationSchemaHandler` (см. выше), гарантирует одну строку `motivation_schemas` на сотрудника
с идентичностями в обеих ERP независимо от того, с какой стороны (`/v1/service/motivation-schema` или
`/v1/shop/accounting/motivation-schema`) пришёл первый запрос.
- `GET /v1/shop/accounting/salary_role_types` — типы зарплатных правил магазина (`PayPerHour`,
  `ProductSold`, `UsedProductSold`, `TaskCompleted`) с перечнем допустимых `targetRole` для каждого;
  набор типов не пересекается с `GET /v1/service/accounting/salary_role_types` сервиса (кроме совпадающих по
  имени `PayPerHour`/`TaskCompleted` — это независимые типы с разными реестрами)
- `POST /v1/shop/accounting/motivation-schema` — создать мотивационную схему магазина (цель + набор
  зарплатных правил магазина, `ShopMotivationRequestSchema` — отдельный от сервисного
  `MotivationRequestSchema` контракт, `rules` — `ShopSalaryRuleRequest[]`); правила пишутся в
  `salary_rules` с `direction: 'shop'`. Find-or-create по `(targetType, targetId)`, см. выше — тот же
  `targetId`, отправленный сюда и в `POST /v1/service/motivation-schema` сервиса, даёт одну строку
  `motivation_schemas` с правилами обоих направлений, а не две. Поведение этого эндпоинта не изменилось
  фазой "Редактирование зарплатных схем" ниже — find-or-create остался прежним
- Просмотр/редактирование зарплатных схем магазина (страница списка/деталей, зеркало одноимённых
  эндпоинтов `service` выше) — направление схемы НЕ хранимое поле, а следствие того, что у строки
  `motivation_schemas` есть ≥1 правило `direction='shop'`; строка с 0 такими правилами (все правила
  принадлежат `service`-стороне той же схемы) для этих трёх эндпоинтов не существует:
  - `GET /v1/shop/accounting/motivation-schema` — список схем магазина. Query: `targetType?`
    (`Department`/`Employee`), `targetId?`, `search?` (подстрока по `name`, без учёта регистра). Ответ —
    `ShopMotivationSchemaListItem[]`: `{ id, name, direction: 'shop', target: { type, id, name },
    ruleCount, ruleTypes, updatedAt }`, `target.name` резолвится через `modules/directory`
    (`Неизвестно (id: N)`, если отдел/сотрудник не найден в справочнике), `ruleTypes` — уникальные типы
    правил схемы в порядке первого появления, `updatedAt = max(schema.updatedAt, ...rules[].updatedAt)`.
    Без пагинации/сортировки на бэкенде
  - `GET /v1/shop/accounting/motivation-schema/:id` — полная схема со всеми правилами
    (`ShopMotivationSchemaDetailResponse`: `{ id, name, direction: 'shop', target, rules:
    ShopSalaryRuleResponse[], updatedAt }`, каждое правило — `{ id, type, name, targetRole, config }`) —
    предзаполнение формы редактирования. `404`, если строки `motivation_schemas` нет ИЛИ у неё 0 правил
    `direction='shop'`
  - `PATCH /v1/shop/accounting/motivation-schema/:id` — переименовать схему и полностью заменить набор
    её правил направления `shop` (`{ name, rules: ShopSalaryRuleRequest[] }`, без `targetType`/
    `targetId` — цель схемы редактированием не меняется). Внутри одной транзакции: переименование →
    `deleteMany({ motivationSchemaId, direction: 'shop' })` (не задевает правила `service` той же
    строки) → пересоздание каждого правила из `rules` через тот же `CreateShopSalaryRuleCommand`, что и
    у `POST` выше (без diff отдельных правил — дельта вычисляется неявно, полная замена). `404` при тех
    же условиях, что и `GET .../motivation-schema/:id`. Ответ — `{ id }`
- Выполнение задачи сотрудником магазина (`ShopTaskCompletion`, Фаза 13.5) — независимая сущность
  (не переиспользует `TaskCompletion` сервиса), тот же двухступенчатый воркфлоу подтверждения
  (`PENDING_CONFIRMATION` → `CONFIRMED`/`REJECTED`, без интеграции с Bitrix24 Tasks) и та же общая
  Prisma-таблица `TaskCompletion`, но пишет `direction: 'shop'`. HTTP DTO переиспользуют сервисные
  Zod-контракты (`createTaskCompletionRequestSchema` и т.д., direction-агностичные по форме) — не
  бизнес-код, только форма запроса/ответа:
  - `POST /v1/shop/accounting/task_completions` — сотрудник магазина отмечает задачу выполненной
    (`{ employeeId, period, description, createdBy }`), сразу в статусе `PENDING_CONFIRMATION`
  - `POST /v1/shop/accounting/task_completions/:id/confirm` — руководитель подтверждает
    (`{ confirmedBy }`) → только такие записи участвуют в расчёте `TaskCompleted.calculate()` магазина
  - `POST /v1/shop/accounting/task_completions/:id/reject` — руководитель отклоняет (`{ confirmedBy }`)
  - `DELETE /v1/shop/accounting/task_completions/:id` — удалить запись
  - `GET /v1/shop/accounting/task_completions?period&employeeId` — записи за период (все сотрудники
    магазина) или одна запись, если указан `employeeId`

## domains/shop/modules/warehouse (`/v1/shop/warehouse`)
Каталог (дерево категорий) магазина — сущность `catalog` модуля `warehouse` (docs/shop-warehouse-catalog).
Читает уже синхронизированную `MoySkladProductFolder` (Фаза 10), без нового синка и без товаров/
остатков — модуль пока состоит из одной сущности `catalog`, сама сущность "Склад" (МойСклад Store) в
системе не заведена (см. PRD).
- `GET /v1/shop/warehouse/catalog` — дерево категорий каталога магазина (`id`/`name`/`pathName`/
  `children`, родитель/потомки, не плоский список); архивные категории не отфильтровываются

## integrations/bitrix (`/bitrix`)
- `POST /bitrix/install` — вебхук установки приложения Bitrix24 (возвращает HTML)

## integrations/roapp (`/roapp`)
- `GET /roapp/service-categories`

## integrations/custom-api-roapp (`/custom-api-roapp`)
- `POST /custom-api-roapp/create-service`
- `GET /custom-api-roapp/service-bonus/:id`

## domains/service/modules/marketing/pricing (`/v1/service/marketing/pricing`)
Цены услуг RemOnline (Фаза 7, docs/todo-modules-ddd-refactoring) — доступ к RoApp только через
`ROAPP_GATEWAY`, без прямых инжектов `RoappService`/`CustomApiRoappService`.
- `POST /v1/service/marketing/pricing/update-service-prices` — обновить цены и себестоимость услуг
  (`[{ id, price, serviceCost }]`): выгружает услуги и категории RoApp, строит пути категорий,
  собирает XLSX и отправляет через `CustomApiRoapp /updateServices`

## domains/shop/modules/marketing/pricing (`/v1/shop/marketing/pricing`)
Импорт закупочных цен магазина из XLSX-прайса поставщика (Фазы 8–10, docs/todo-modules-ddd-refactoring)
— новый дом легаси `/price-monitoring/*` (легаси-модуль `TODO/priceMonitoring` удалён вместе с этой
фазой). Доменное ядро — агрегат `PriceImportJob` со статусами `CREATED → RUNNING → COMPLETED/FAILED`
(инварианты переходов, доменные события); пайплайн: парсинг XLSX → AI-форматирование названий iPad/
MacBook → категоризация строк → загрузка каталога МойСклад по категории → AI-сопоставление строка ×
товар → обновление закупочных цен в МойСклад → запись результата в Google Sheets. Состояние джобы между
HTTP-запросами (поллинг/SSE) доступно только через порт `PRICE_IMPORT_JOB_STORE` (in-memory, на
процесс, без персистентности — та же гарантия, что была у легаси `PriceMonitoringProgressService`).
- `POST /v1/shop/marketing/pricing/import-costs` — запустить импорт закупочных цен из XLSX-прайса
  (`{ file: <base64> }`); fire-and-forget, как и легаси `update-shop-products-costs` — джоба стартует в
  фоне, ответ `{ id }` не дожидается завершения пайплайна
- `GET /v1/shop/marketing/pricing/import-costs/:id/status` — разовый снапшот статуса и текущего
  прогресса джобы (`{ id, status, progress: { stage, processed, total, message, percent } | null,
  errorMessage }`); `404`, если `id` не найден
- `GET /v1/shop/marketing/pricing/import-costs/:id` — SSE-поток тех же снапшотов джобы; heartbeat
  каждые 20с против таймаута Nginx (сохранён из легаси-SSE-эндпоинта без изменений); `404`, если `id`
  не найден
