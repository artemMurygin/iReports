# Эндпоинты backend (backend/src)

Все пути указаны от корня, глобальный префикс не задан.

## domains/service/modules/accounting (`/accounting`, `/v1/motivation-schema`)
- `GET /accounting/salary_report/employee/:id/:period` — отчёт по зарплате сотрудника за период (`period` — `YYYY-MM`), с Фазы 13.5 (см. `docs/payroll/phase-13.5-shop-report-integration.md`) — ВСЕГДА оба направления сразу: `directions` — массив из ровно двух элементов (`service` и `shop`), каждый со своим `isClosed`, `total.{fact,prognose}`, разбивкой по правилам, компактным `salesPerformance` и `isPlanApproved` — направления закрываются независимо, поэтому статус закрытия и `prognose` (`null` только для закрытого направления, снапшот прогноз не хранит) — свойство направления, а не всего ответа. `grandTotal.fact` — сумма `direction.total.fact` по обоим направлениям (всегда число); `grandTotal.prognose` — сумма `direction.total.prognose ?? direction.total.fact` (тоже всегда число, никогда `null`: для закрытого направления берётся его финальный факт). Пара «факт/прогноз» внутри направления — режим расчёта `FACT`/`PROGNOSE` (Фаза 9: прогноз берёт `SalesPrognose.percentCompletion` вместо `SalesFact.percentCompletion`, личная база сотрудника не экстраполируется), для `FloatPercent` — `floatPercent.{fact,prognose}.{currentThreshold,nextThreshold,diffToNext}`. Открытое направление — ленивый кэш по штампу синхронизации/версии схемы/плана продаж (Фаза 6, ключ `(direction, period, employeeId)`); закрытое — отдаётся из неизменяемого снапшота этого направления
- `GET /accounting/salary_report/department/:id/:period` — отчёт по зарплатам отдела за период (Фаза 9, дополнено Фазой 13.5): тот же расчёт, что и у отчёта сотрудника, агрегированный по каждому сотруднику отдела — но, в отличие от отчёта сотрудника, БЕЗ `directions[]`-разбивки (сознательное упрощение): `employees[].rules` объединяет строки ОБОИХ направлений одним плоским списком, а верхнеуровневый `isClosed` — `true`, только если периоды закрыты у обоих направлений сразу (`employees[].total.prognose`/`total.prognose` отдела — `null` только в этом случае). Контекст ERP-данных/`SalesPerformance`/схем/идентичностей/часов собирается один раз на весь отдел по каждому направлению, без N+1 запросов на сотрудника
- `POST /v1/motivation-schema` — создать мотивационную схему (цель + набор зарплатных правил, `direction: 'service'` — правила пишутся с этим дискриминатором в `salary_rules`). Find-or-create по естественному ключу `(targetType, targetId)` строки `motivation_schemas` (Фаза 13.5, issue #57) — если у сотрудника уже есть строка схемы, созданная с shop-стороны (`POST /shop/accounting/motivation-schema` ниже, тот же `targetId`), вторая строка не создаётся, новые правила добавляются к существующей схеме; так сотрудник с идентичностями в обеих ERP получает ровно одну строку `motivation_schemas` независимо от порядка обращений с обеих сторон
- Расчётный период (`AccountingPeriod`, Фаза 6, дополнено Фазой 13.5, см. docs/payroll/plan-payroll-calculation.md и docs/payroll/phase-13.5-shop-report-integration.md) — сервис и магазин закрываются НЕЗАВИСИМО (`direction` в пути, свой `AccountingPeriod`/снапшот на каждое направление): закрытие `service` не трогает открытый период/снапшот `shop`, и наоборот (`CloseAccountingPeriodHandler` выбирает мотивационную схему/контекст-билдер/оркестратор по `direction`, включая shop-версии из `domains/shop/modules/accounting`). Эндпоинты без гарда (см. «неблокирующие вопросы» PRD, то же решение, что и у `sales`):
  - `GET /accounting/period/:direction/:period` — статус периода; для периода без записи в БД возвращает `status = OPEN`
  - `POST /accounting/period/:direction/:period/close` — закрыть период (`{ closedBy }`): отклоняется (`409`) со списком строк в `metadata.rows`, если в плане продаж периода (этого направления) есть неутверждённые строки; при успехе создаёт неизменяемый снапшот по каждому сотруднику с личной мотивационной схемой ЭТОГО направления (`service` — `MotivationSchemaRepositoryPort.findAllEmployeeTargets`, `shop` — `ShopMotivationSchemaRepositoryPort.findAllEmployeeTargets`)
  - `POST /accounting/period/:direction/:period/reopen` — повторно открыть закрытый период (`{ confirm: true }`), удаляет снапшот целиком
  - `POST /accounting/period/:direction/:period/recalculate` — сбросить кэш открытого периода (действие «пересчитать» для руководителя); `204`, закрытый период — `409`
- Ручной ввод часов сотрудника за период (`EmployeeHoursEntry`, Фаза 7, см. docs/payroll/plan-payroll-calculation.md) — минимальный источник данных для `PayPerHour.calculate()` (полноценный график работы вне скоупа); эндпоинты без гарда, как и остальной `accounting`:
  - `POST /accounting/employee_hours` — создать запись (`{ employeeId, period, hours }`); повтор на ту же пару `(employeeId, period)` отклоняется (`409`)
  - `PATCH /accounting/employee_hours/:id` — изменить количество часов
  - `DELETE /accounting/employee_hours/:id` — удалить запись
  - `GET /accounting/employee_hours?period&employeeId` — записи за период (все сотрудники) или одна запись, если указан `employeeId`
- `GET /accounting/salary_role_types` — типы зарплатных правил сервиса (`PayPerHour`, `ServiceCompleted`, `OrderPayed`, `TaskCompleted`) с перечнем допустимых `targetRole` для каждого (Фаза 8)
- Выполнение задачи сотрудником (`TaskCompletion`, Фаза 8, см. docs/payroll/plan-payroll-calculation.md) — временный внутренний двухступенчатый воркфлоу подтверждения без интеграции с Bitrix24 Tasks (синхронизация с реальными задачами запланирована отдельной фазой); эндпоинты без гарда, как и остальной `accounting`. `TaskCompletion.direction` (Фаза 13, дефолт `'service'`) — эти эндпоинты всегда пишут/читают `direction: 'service'`; направление `shop` пишет/читает ту же таблицу (`direction: 'shop'`) через собственный, независимый CQRS-вход `POST/GET /shop/accounting/task_completions*` (Фаза 13.5, см. ниже) — ту же пару Zod-контрактов (`createTaskCompletionRequestSchema`/`confirmTaskCompletionRequestSchema`/…) переиспользует HTTP-DTO, а не бизнес-логика:
  - `POST /accounting/task_completions` — сотрудник отмечает задачу выполненной (`{ employeeId, period, description, createdBy }`), сразу в статусе `PENDING_CONFIRMATION`
  - `POST /accounting/task_completions/:id/confirm` — руководитель подтверждает (`{ confirmedBy }`) → только такие записи участвуют в расчёте `TaskCompleted.calculate()`
  - `POST /accounting/task_completions/:id/reject` — руководитель отклоняет (`{ confirmedBy }`)
  - `DELETE /accounting/task_completions/:id` — удалить запись
  - `GET /accounting/task_completions?period&employeeId` — записи за период (все сотрудники) или одна запись, если указан `employeeId`

## modules/employee-identity (`/v1/employee-identity`)
Идентификация сотрудника между Bitrix24 / RemOnline / МойСклад (Фаза 2). Все эндпоинты закрыты
`PortalAdminGuard` — доступны только администратору портала Bitrix24 (заголовок `x-bitrix-auth` с
access token текущего пользователя из `BX24.getAuth()`); без токена или не-администратору — `403`.
- `POST /v1/employee-identity` — создать связь «сотрудник Bitrix × внешняя система × внешний идентификатор»
- `PATCH /v1/employee-identity/:id` — изменить тип идентификатора и/или внешний ID связи
- `DELETE /v1/employee-identity/:id` — удалить связь
- `GET /v1/employee-identity/employee/:employeeId` — связи конкретного сотрудника
- `GET /v1/employee-identity/unmatched` — сотрудники Bitrix без единой связи ни в одной системе

## domains/service/modules/sales (`/v1/sales/plan`, `/v1/sales/plan_template`, `/v1/sales/salesPerformance`)
План продаж (Фаза 3) — вход для всех процентных зарплатных правил. Модели общие для направлений
`service`/`shop` (Фаза 11 переиспользует их без изменения формы, включая сам CRUD ниже — он не
привязан к `direction: 'service'` и одинаково обслуживает оба направления). Без модели прав в проекте
эндпоинты не закрыты гардом (в отличие от `employee-identity`, см. «неблокирующие вопросы» PRD).
- `POST /v1/sales/plan` — создать план месяца по отделу и, опционально, категории (`source = MANUAL`); повтор на ту же комбинацию `(direction, department, category, period)` отклоняется (`409`)
- `GET /v1/sales/plan?direction&period` — план месяца по направлению
- `PATCH /v1/sales/plan/:id` — изменить оборот/маржу; переводит строку в `source = MANUAL`, утверждённую строку возвращает в `status = CREATED`
- `DELETE /v1/sales/plan/:id` — удалить строку плана
- `POST /v1/sales/plan/approve` — утвердить построчно (`{ ids, approvedBy }`) или весь месяц по направлению (`{ direction, period, approvedBy }`); уже утверждённые строки не трогает
- `GET /v1/sales/plan_template?direction` — дефолтный шаблон плана (оборот, маржа, процент роста) по отделам/категориям
- `PUT /v1/sales/plan_template` — upsert строки шаблона по естественному ключу `(direction, department, category)`
- `GET /v1/sales/salesPerformance/:period?direction` — план, факт и прогноз одним запросом по каждому отделу и категории направления за период (Фаза 5); факт и прогноз не персистятся, считаются заново на каждый запрос по данным ERP и текущему плану. Поддержан только `direction=service` (`400` для любого другого значения) — читатель этого эндпоинта жёстко привязан к RoApp/RemOnline; для `shop` см. отдельный эндпоинт `domains/shop/modules/sales` ниже

## domains/shop/modules/sales (`/v1/sales/salesPerformance/shop`)
SalesFact/SalesPrognose/SalesPerformance направления `shop` по данным МойСклад (Фаза 11, issue #54/#55)
— зеркало `GetSalesPerformanceService` направления `service`, отдельный эндпоинт вместо `direction` в
query у общего пути `/v1/sales/salesPerformance/:period` (см. обоснование в `config/app.routes.ts`).
План/шаблон плана для `shop` обслуживаются CRUD-эндпоинтами `domains/service/modules/sales` выше —
отдельного дублирующего CRUD у этого модуля нет. Автосоздание плана — свой крон первого числа
(`ShopSalesPlanAutoCreationCron`, `@ProdCron`) поверх общего `EnsureSalesPlansForPeriodService`, плюс
ленивое достраивание при первом обращении к периоду (тот же механизм, что и у `service`).
- `GET /v1/sales/salesPerformance/shop/:period` — план, факт и прогноз одним запросом по каждому отделу направления `shop` за период; ⚠️ `fact.margin` — сумма `MoySkladDemandPosition.profit` по позициям отгрузок периода, а не `turnover - cost` (значение уже посчитано в МойСклад с учётом метода списания себестоимости); `quantity` — сумма `Float` (весовой/дробный товар)

## domains/shop/modules/accounting (`/shop/accounting`)
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
Фазой 13.5 — направление `shop` подключено к тому же контуру, что и `service`: сквозной отчёт (см.
`GET /accounting/salary_report/employee|department/:id/:period` выше, теперь `direction`-aware),
закрытие периода (`POST /accounting/period/:direction/:period/close`, `direction=shop`) и HTTP-запись
мотивационной схемы/задач ниже. `MotivationSchema`/`SalaryRule` — та же Prisma-таблица, что и у
`service` (`motivation_schemas` без колонки `direction`, `salary_rules.direction = 'shop'`); find-or-
create по `(targetType, targetId)` в `CreateShopMotivationSchemaHandler` — зеркало сервисного
`CreateMotivationSchemaHandler` (см. выше), гарантирует одну строку `motivation_schemas` на сотрудника
с идентичностями в обеих ERP независимо от того, с какой стороны (`/v1/motivation-schema` или
`/shop/accounting/motivation-schema`) пришёл первый запрос.
- `GET /shop/accounting/salary_role_types` — типы зарплатных правил магазина (`PayPerHour`,
  `ProductSold`, `UsedProductSold`, `TaskCompleted`) с перечнем допустимых `targetRole` для каждого;
  набор типов не пересекается с `GET /accounting/salary_role_types` сервиса (кроме совпадающих по
  имени `PayPerHour`/`TaskCompleted` — это независимые типы с разными реестрами)
- `POST /shop/accounting/motivation-schema` — создать мотивационную схему магазина (цель + набор
  зарплатных правил магазина, `ShopMotivationRequestSchema` — отдельный от сервисного
  `MotivationRequestSchema` контракт, `rules` — `ShopSalaryRuleRequest[]`); правила пишутся в
  `salary_rules` с `direction: 'shop'`. Find-or-create по `(targetType, targetId)`, см. выше — тот же
  `targetId`, отправленный сюда и в `POST /v1/motivation-schema` сервиса, даёт одну строку
  `motivation_schemas` с правилами обоих направлений, а не две
- Выполнение задачи сотрудником магазина (`ShopTaskCompletion`, Фаза 13.5) — независимая сущность
  (не переиспользует `TaskCompletion` сервиса), тот же двухступенчатый воркфлоу подтверждения
  (`PENDING_CONFIRMATION` → `CONFIRMED`/`REJECTED`, без интеграции с Bitrix24 Tasks) и та же общая
  Prisma-таблица `TaskCompletion`, но пишет `direction: 'shop'`. HTTP DTO переиспользуют сервисные
  Zod-контракты (`createTaskCompletionRequestSchema` и т.д., direction-агностичные по форме) — не
  бизнес-код, только форма запроса/ответа:
  - `POST /shop/accounting/task_completions` — сотрудник магазина отмечает задачу выполненной
    (`{ employeeId, period, description, createdBy }`), сразу в статусе `PENDING_CONFIRMATION`
  - `POST /shop/accounting/task_completions/:id/confirm` — руководитель подтверждает
    (`{ confirmedBy }`) → только такие записи участвуют в расчёте `TaskCompleted.calculate()` магазина
  - `POST /shop/accounting/task_completions/:id/reject` — руководитель отклоняет (`{ confirmedBy }`)
  - `DELETE /shop/accounting/task_completions/:id` — удалить запись
  - `GET /shop/accounting/task_completions?period&employeeId` — записи за период (все сотрудники
    магазина) или одна запись, если указан `employeeId`

## deals (`/deals`)
- `GET /deals?from&to` — список сделок за период
- `GET /deals/stages` — этапы
- `GET /deals/models` — модели устройств
- `GET /deals/managers` — менеджеры
- `GET /deals/sources` — источники
- `GET /deals/stage-groups` — группы этапов

## integrations/bitrix (`/bitrix`)
- `POST /bitrix/install` — вебхук установки приложения Bitrix24 (возвращает HTML)

## integrations/roapp (`/roapp`)
- `GET /roapp/service-categories`

## integrations/custom-api-roapp (`/custom-api-roapp`)
- `POST /custom-api-roapp/create-service`
- `GET /custom-api-roapp/service-bonus/:id`

## priceMonitoring (`/price-monitoring`)
- `POST /price-monitoring/update-shop-products-costs`
- `POST /price-monitoring/update-service-price`
- `GET /price-monitoring/:uuid/status`
- `GET /price-monitoring/:uuid` — SSE (прогресс задачи + heartbeat)

## reports (`/reports`)
- `GET /reports/service-funnel`
- `GET /reports/service-categories`
- `GET /reports/services-analytics`
