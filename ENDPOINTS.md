# Эндпоинты backend (backend/src)

Все пути указаны от корня, глобальный префикс не задан.

## domains/service/modules/accounting (`/accounting`, `/v1/motivation-schema`)
- `GET /accounting/salary_report/employee/:id/:period` — отчёт по зарплате сотрудника за период (`period` — `YYYY-MM`): итог и разбивка по правилам мотивационной схемы, пара «факт/прогноз» (Фаза 9 — режим расчёта `FACT`/`PROGNOSE`: прогноз берёт `SalesPrognose.percentCompletion` вместо `SalesFact.percentCompletion`, личная база сотрудника не экстраполируется), компактный блок `salesPerformance` по отделу сотрудника и признак `isPlanApproved`, для `FloatPercent` — `floatPercent.{fact,prognose}.{currentThreshold,nextThreshold,diffToNext}`. Открытый период — ленивый кэш по штампу синхронизации/версии схемы/плана продаж (Фаза 6); закрытый — отдаётся из неизменяемого снапшота, поля `prognose` пустые (`null`) — снапшот прогноз не хранит
- `GET /accounting/salary_report/department/:id/:period` — отчёт по зарплатам отдела за период (Фаза 9): тот же расчёт, что и у отчёта сотрудника, агрегированный по каждому сотруднику отдела (общая сумма + разбивка по его зарплатным правилам) плюс итог по отделу; контекст ERP-данных/`SalesPerformance`/схем/идентичностей/часов собирается один раз на весь отдел, без N+1 запросов на сотрудника. Открытый период — факт и прогноз рядом (и по сотруднику, и по отделу), один и тот же ленивый кэш, что и у отчёта сотрудника; закрытый — только факт из снапшота, поля `prognose` пустые
- `POST /v1/motivation-schema` — создать мотивационную схему (цель + набор зарплатных правил)
- Расчётный период (`AccountingPeriod`, Фаза 6, см. docs/payroll/plan-payroll-calculation.md) — сервис и магазин закрываются независимо (`direction` в пути); эндпоинты без гарда (см. «неблокирующие вопросы» PRD, то же решение, что и у `sales`):
  - `GET /accounting/period/:direction/:period` — статус периода; для периода без записи в БД возвращает `status = OPEN`
  - `POST /accounting/period/:direction/:period/close` — закрыть период (`{ closedBy }`): отклоняется (`409`) со списком строк в `metadata.rows`, если в плане продаж периода есть неутверждённые строки; при успехе создаёт неизменяемый снапшот по каждому сотруднику с личной мотивационной схемой
  - `POST /accounting/period/:direction/:period/reopen` — повторно открыть закрытый период (`{ confirm: true }`), удаляет снапшот целиком
  - `POST /accounting/period/:direction/:period/recalculate` — сбросить кэш открытого периода (действие «пересчитать» для руководителя); `204`, закрытый период — `409`
- Ручной ввод часов сотрудника за период (`EmployeeHoursEntry`, Фаза 7, см. docs/payroll/plan-payroll-calculation.md) — минимальный источник данных для `PayPerHour.calculate()` (полноценный график работы вне скоупа); эндпоинты без гарда, как и остальной `accounting`:
  - `POST /accounting/employee_hours` — создать запись (`{ employeeId, period, hours }`); повтор на ту же пару `(employeeId, period)` отклоняется (`409`)
  - `PATCH /accounting/employee_hours/:id` — изменить количество часов
  - `DELETE /accounting/employee_hours/:id` — удалить запись
  - `GET /accounting/employee_hours?period&employeeId` — записи за период (все сотрудники) или одна запись, если указан `employeeId`
- `GET /accounting/salary_role_types` — типы зарплатных правил сервиса (`PayPerHour`, `ServiceCompleted`, `OrderPayed`, `TaskCompleted`) с перечнем допустимых `targetRole` для каждого (Фаза 8)
- Выполнение задачи сотрудником (`TaskCompletion`, Фаза 8, см. docs/payroll/plan-payroll-calculation.md) — временный внутренний двухступенчатый воркфлоу подтверждения без интеграции с Bitrix24 Tasks (синхронизация с реальными задачами запланирована отдельной фазой); эндпоинты без гарда, как и остальной `accounting`:
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
`service`/`shop` (Фаза 11 переиспользует их без изменения формы). Без модели прав в проекте эндпоинты
не закрыты гардом (в отличие от `employee-identity`, см. «неблокирующие вопросы» PRD).
- `POST /v1/sales/plan` — создать план месяца по отделу и, опционально, категории (`source = MANUAL`); повтор на ту же комбинацию `(direction, department, category, period)` отклоняется (`409`)
- `GET /v1/sales/plan?direction&period` — план месяца по направлению
- `PATCH /v1/sales/plan/:id` — изменить оборот/маржу; переводит строку в `source = MANUAL`, утверждённую строку возвращает в `status = CREATED`
- `DELETE /v1/sales/plan/:id` — удалить строку плана
- `POST /v1/sales/plan/approve` — утвердить построчно (`{ ids, approvedBy }`) или весь месяц по направлению (`{ direction, period, approvedBy }`); уже утверждённые строки не трогает
- `GET /v1/sales/plan_template?direction` — дефолтный шаблон плана (оборот, маржа, процент роста) по отделам/категориям
- `PUT /v1/sales/plan_template` — upsert строки шаблона по естественному ключу `(direction, department, category)`
- `GET /v1/sales/salesPerformance/:period?direction` — план, факт и прогноз одним запросом по каждому отделу и категории направления за период (Фаза 5); факт и прогноз не персистятся, считаются заново на каждый запрос по данным ERP и текущему плану. В этой фазе поддержан только `direction=service` (`shop` — `400`, появится в Фазе 11)

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

## salary/adjustments (`/salary-adjustments`)
- `POST /salary-adjustments`
- `GET /salary-adjustments?employeeId&period`

## salary/categories (`/salary/categories`)
- `GET /salary/categories?direction`

## salary/directory (`/salary`)
- `GET /salary/employees`
- `GET /salary/departments`
- `PATCH /salary/employees/:id`

## salary/goals (`/goals`)
- `POST /goals`
- `PATCH /goals/:id`
- `DELETE /goals/:id` (204)

## salary/plan-fact (без префикса)
- `GET /plan-fact?filter`
- `POST /plan-targets`
- `PATCH /plan-targets/:id`
- `DELETE /plan-targets/:id` (204)

## salary/report (`/salaryReport`)
- `GET /salaryReport?employeeId&period`
- `POST /salaryReport/close`

## salary/rewards (`/rewards`)
- `POST /rewards`
- `PATCH /rewards/:id`

## salary/rules (`/salary-rules`)
- `GET /salary-rules?filter`
- `POST /salary-rules`
- `PATCH /salary-rules/:id`
- `POST /salary-rules/:id/archive`
- `DELETE /salary-rules/:id` (204)

## salary/task-completions (`/task-completions`)
- `POST /task-completions`
- `PATCH /task-completions/:id`

## salary/turnover (`/turnover`)
- `GET /turnover?period` — заглушка, всегда отвечает 501 "NO_DATA" (нет интеграции с МойСклад)

## salary/work-schedule (без префикса)
- `GET /work-schedule?employeeId&period`
- `POST /work-schedule/bulk`
- `PATCH /work-shifts/:id`