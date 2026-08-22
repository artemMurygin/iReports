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
  - `POST /v1/service/accounting/period/:period/close` — закрыть период (`{ closedBy }`): отклоняется (`409`) со списком строк в `metadata.rows`, если в плане продаж периода есть неутверждённые строки; при успехе сбрасывает кэш периода, создаёт неизменяемый снапшот по каждому сотруднику с личной мотивационной схемой (или схемой его отдела) и — в той же транзакции — документ начисления `SalaryAccrual` в статусе `DRAFT` на каждого сотрудника снапшота, включая нулевые суммы и уволенных (`isDismissed` по активности `BitrixEmployee` на момент закрытия); после коммита публикуется `SalaryAccrualDocumentsCreatedDomainEvent` (PRD 1 docs/payroll-closing-and-accrual). Фаза 2 PRD 1: закрыть можно только истёкший календарный месяц (текущий/будущий → `409`), уже закрытый → `409`; перед расчётом выполняется неявная синхронизация заказов RemOnline, закрытых в месяце (таймаут 2 мин, блокировка направления от тика `RoappSyncCron`), ошибка/таймаут синка → `409` «не удалось получить данные из ERP», период остаётся открытым, ничего не создаётся
  - `GET /v1/service/accounting/period/:period/close-preview` — сводка окна подтверждения закрытия (`ClosePeriodPreviewResponse`: `employeesCount`, `dismissedEmployeesCount`, `totalAmount`, `unapprovedPlanRows`, `employeesWithoutHours` — сотрудники с правилом `PayPerHour` без записи часов за месяц); считается тем же калькулятором строк снапшота, что и `close`, поэтому совпадает с результатом реального закрытия; ничего не пишет и ERP не синхронизирует
  - `POST /v1/service/accounting/period/:period/reopen` — повторно открыть закрытый период (`{ confirm: true }`): если все документы начисления периода в `DRAFT` — удаляет документы и снапшот целиком; иначе `409` с перечнем документов не в `DRAFT` в `metadata.accruals` (`{ id, employeeId, status }[]`), ничего не удаляется
  - `POST /v1/service/accounting/period/:period/recalculate` — сбросить кэш открытого периода (действие «пересчитать» для руководителя); `204`, закрытый период — `409`
- Документы начисления зарплаты (`SalaryAccrual`, PRD 1 docs/payroll-closing-and-accrual, Фаза 1) — рождаются только закрытием периода (см. `close` выше), один документ на `(direction, period, employeeId)`; чтение, без гарда:
  - `GET /v1/service/accounting/salary_accruals?period=YYYY-MM` — список документов направления `service` за период: `{ direction, period, items: SalaryAccrual[], total }`, где `SalaryAccrual` — `{ id, direction, period, employeeId, employeeName, departmentId, status, isDismissed, total, linesCount, accruedLinesCount, createdAt }` (`employeeName`/`departmentId` — из справочника Bitrix на чтении, `isDismissed` — зафиксирован в документе; `accruedLinesCount` — число уже проведённых строк для прогресса «N из M», Фаза 6 PRD 2). До закрытия периода — пустой список; `period` обязателен (`400`)
  - `GET /v1/service/accounting/salary_accruals/:id` — карточка документа: то же + `lines: SalaryAccrualLine[]` — строка на каждое зарплатное правило снапшота (`ruleId, type, name, targetRole, salaryBasis, quantity, rate, amount, originalAmount, status, adjustmentComment, sources`); `404`, если документ не найден или принадлежит другому направлению
  - `POST /v1/service/accounting/salary_accruals/:id/lines/:lineId/accrue` — провести строку документа на баланс сотрудника (`{ accruedBy }`, Bitrix ID руководителя; PRD 2 docs/payroll-closing-and-accrual, Фаза 6). В одной транзакции: движение баланса `SALARY_ACCRUAL` на сумму снапшота (`originalAmount`) со ссылками-идентификаторами (`accrualId`/`lineId`/`ruleId`/`period`/`direction`), для скорректированной строки — второе движение `ACCRUAL_ADJUSTMENT` на разницу с комментарием корректировки (сумма двух движений = действующая сумма строки), строка → `ACCRUED`, статус документа пересчитывается из строк (`DRAFT`/`PARTIALLY_ACCRUED`/`ACCRUED`). Идемпотентность — уникальный индекс БД `(lineId, type)`: повторный и параллельный accrue → `409`, второго движения не бывает; документ `PAID` → `409`; ответ — обновлённая карточка документа
  - `POST /v1/service/accounting/salary_accruals/:id/lines/:lineId/unaccrue` — отменить начисление строки (без тела): движения `SALARY_ACCRUAL` и `ACCRUAL_ADJUSTMENT` строки УДАЛЯЮТСЯ с баланса без следа (начисление до выплаты считается черновиком расчёта), строка → `DRAFT` в той же транзакции, статус документа пересчитывается; непроведённая строка или документ `PAID` → `409`; ответ — карточка документа
  - `PATCH /v1/service/accounting/salary_accruals/:id/lines/:lineId` — корректировка строки до проведения (`{ amount, comment, adjustedBy }`, комментарий обязателен → `400` без него): меняет действующую сумму `amount`, `originalAmount` остаётся следом исходного расчёта, история корректировок хранится (`SalaryAccrualLineAdjustment`), в ответе строки — `adjustmentComment` последней корректировки; строка в `ACCRUED` → `409`; ответ — карточка документа
  - `POST /v1/service/accounting/salary_accruals/:id/accrue` — «Начислить всё» по документу (`{ accruedBy }`, Фаза 7 PRD 2): все `DRAFT`-строки проводятся построчно, каждая в СВОЕЙ транзакции (внутренний диспатч построчной команды), сбой одной строки не откатывает остальные; ответ `{ accrual, failures[] }` — обновлённая карточка и перечень неудачных строк (`{ accrualId, employeeId, employeeName, lineId, ruleName, message }`); полностью проведённый документ — no-op с пустым перечнем, `PAID` → `409`
  - `POST /v1/service/accounting/salary_accruals/accrue?period=YYYY-MM` — «Начислить все документы месяца» (`{ accruedBy }`): построчное проведение всех документов направления за период (документы `PAID` пропускаются); ответ — статистика для модалки результата `{ direction, period, documentsCount, accruedDocumentsCount, accruedLinesCount, accruedAmount, failures[] }` (`accruedDocumentsCount` — полностью проведённые после операции, `accruedLinesCount`/`accruedAmount` — строки, проведённые именно этой операцией); открытый период — нулевая статистика
- Баланс сотрудника (`BalanceTransaction`, PRD 2 docs/payroll-closing-and-accrual; Фаза 8b — баланс ОБЩИЙ по сотруднику) — одна лента движений денег на `employeeId` без деления на направления, единственный источник истины об остатке (хранимого поля «остаток» нет; суммы — Int в целых рублях со знаком); `direction` движения — лишь атрибут происхождения. Эндпоинты общие, под `/v1/accounting/balance` (вне `/v1/service` и `/v1/shop`), без гарда; у движения нет `PATCH`, движения начисления удаляются только `unaccrue` строки:
  - `GET /v1/accounting/balance/employee/:id?from&to&types` — остаток (`balance` = `SUM` всей ленты сотрудника независимо от направления движений, от фильтров не зависит) и движения с фильтрами: `from`/`to` — ISO-даты по дате движения `occurredAt`, `types` — список типов через запятую (`?types=SALARY_ACCRUAL,ADVANCE`; перечень заложен целиком: `SALARY_ACCRUAL, ACCRUAL_ADJUSTMENT, ADVANCE, EXTRA_ADVANCE, BONUS, SICK_LEAVE, VACATION_PAY, PENALTY, ADJUSTMENT, PAYOUT`; `PAYOUT` — PRD 3). Ответ `{ employeeId, balance, selectionTotal, transactions[] }`; `selectionTotal` — сумма выборки; движение несёт ссылки-идентификаторы (`accrualId`/`lineId`/`ruleId`) и признак `erpSyncRequired`; строка ленты НЕ раскрывается — детализация начисления живёт в документе начисления, UI ведёт на него по `accrualId` (Фаза 8b). Сотрудник без движений — `balance: 0` и пустая лента
  - `POST /v1/accounting/balance/employee/:id/transactions` — ручное движение руководителя (Фаза 7 PRD 2): `{ direction, type, amount, occurredAt?, comment?, period?, createdBy, erpSyncRequired? }`, `type` из `ADVANCE | EXTRA_ADVANCE | BONUS | SICK_LEAVE | VACATION_PAY | PENALTY | ADJUSTMENT`; `direction` — атрибут происхождения из тела (эндпоинт общий; направление нужно кассе ERP в PRD 3). Знак определяется типом (`ADVANCE`/`EXTRA_ADVANCE`/`PENALTY` — расход, `BONUS`/`SICK_LEAVE`/`VACATION_PAY` — приход; `amount` в запросе — абсолютная величина > 0), для `ADJUSTMENT` знак задаётся явно (`amount` со знаком, ≠ 0). Комментарий обязателен для `PENALTY`/`ADJUSTMENT` (→ `400`). `occurredAt` — дата движения, разрешена задним числом, в т.ч. внутри закрытого месяца — снапшот и документы начисления при этом НЕ меняются; `createdAt` в ленте показывает, что запись создана позже. Лимитов на аванс нет — отрицательный остаток штатен, остаток не проверяется. `erpSyncRequired` в этой итерации только хранится и отдаётся (касса ERP — PRD 3). Ответ — созданное движение (`BalanceTransaction`)
  - `DELETE /v1/accounting/balance/transactions/:id` — удалить ошибочное ручное движение без документа ERP (Фаза 8b, без тела): запись исчезает из ленты, остаток пересчитывается; `204`. Движение начисления → `409` (удаляется только `unaccrue` строки документа), `erpSyncRequired: true` → `409` (удаляется вместе с документом ERP — PRD 3), несуществующее/уже удалённое → `404`
  - `GET /v1/accounting/balance/department/:id/:period` — сводка общих балансов по отделу за месяц (Фаза 7 PRD 2): состав сотрудников — ТЕКУЩИЙ отдел из справочника Bitrix24 на момент запроса (в движении отдел не хранится). Ответ `{ departmentId, period, employees[], totals }`; строка сотрудника — `{ employeeId, employeeName, balance, accrued, advances, manual, accrualStatus }`: `balance` — `SUM` всей ленты сотрудника (от периода не зависит), `accrued` — движения начисления (`SALARY_ACCRUAL`/`ACCRUAL_ADJUSTMENT`) обоих направлений с полем `period` запрошенного месяца, `advances` — `ADVANCE`/`EXTRA_ADVANCE` по дате движения внутри месяца, `manual` — остальные ручные типы по дате внутри месяца (суммы со знаком, как в ленте; `PAYOUT` — только в `balance`), `accrualStatus` — сводный статус документов начисления сотрудника за период по обоим направлениям (наименее продвинутый: `DRAFT` < `PARTIALLY_ACCRUED` < `ACCRUED` < `PAID`; `null` — документов нет); `totals` — сумма строк сотрудников
  - В ответе `GET .../salary_report/employee/:id/:period` появилось поле `accrualStatus` (`DRAFT | PARTIALLY_ACCRUED | ACCRUED | PAID | null`) — статус документа начисления сотрудника за закрытый период; `null` для открытого периода или если сотрудник в снапшот не попал
- Источник часов `PayPerHour.calculate()` (Фаза 5, `docs/employee-work-schedule`) — сумма часов смен `WorkScheduleEntry.status = WORKING` сотрудника за период (`modules/work-schedule`, см. ниже), читаемая `ServiceCalculationDataRepository.findHoursWorked` напрямую из БД. Прежний ручной ввод часов (`EmployeeHoursEntry`, CRUD-эндпоинты под `/v1/service/accounting`, Фаза 7) удалён вместе с моделью; существующие записи перенесены разовой миграцией `npm run migrate:work-schedule-hours` (`backend/src/shared/migrateWorkScheduleHours.ts`), которая также сбрасывает кэш расчёта (`AccountingCalculationCache`) затронутых открытых периодов. Запись/удаление дня графика (`PUT`/`DELETE /v1/work-schedule/entries*`, см. ниже) отклоняется `409` с `metadata.{ direction, period, closedBy, closedAt }`, если месяц записи закрыт (`AccountingPeriod` в `CLOSED`) по ЛЮБОМУ направлению — тот же `EnsurePeriodNotClosedService`, что раньше блокировал `EmployeeHoursEntry` (PRD 1 docs/payroll-closing-and-accrual, Фаза 2); `reopen` снимает блокировку
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

## modules/work-schedule (`/v1/work-schedule`)
График работы сотрудников (Фаза 1, `docs/employee-work-schedule`) — общая на компанию модель
`WorkScheduleEntry` (пара «сотрудник × календарный день» → статус дня, часы смены, роль дня), модуль
не привязан к домену `service`/`shop` (тот же принцип, что и у `modules/directory`/
`modules/employee-identity`): читать график в Фазе 5 будут контексты расчёта зарплаты обоих
направлений. Модуль импортирует `DirectoryModule` (список сотрудников отдела для чтения месяца и
состава смены на дату). Читающие эндпоинты без гарда, тот же принцип, что и у `modules/directory`;
`PUT`/`DELETE` ниже блокируются закрытым периодом (`EnsurePeriodNotClosedService`, свой экземпляр
токена `ACCOUNTING_PERIOD_REPOSITORY` в модуле — тот же приём, что и у `ShopAccountingModule`, чтобы
не тянуть в `modules/work-schedule` весь `AccountingModule` сервиса ради одного токена).
- `PUT /v1/work-schedule/entries` — создать или изменить запись дня, идемпотентный upsert по
  естественному ключу `(employeeId, date)` (`{ employeeId, date: 'YYYY-MM-DD', status, hours?, role? }`,
  `status` — `WORKING`/`DAY_OFF`/`TIME_OFF`/`SICK_LEAVE`/`VACATION`); повтор на ту же пару правит
  существующую запись, а не создаёт вторую. `hours` (2–16, шаг 0,5) и `role` (`TargetRole`) допустимы
  только при `status = WORKING` — иначе `400`; часы вне диапазона/шага — тоже `400`. Месяц даты записи
  закрыт по любому направлению (`AccountingPeriod` в `CLOSED`) → `409` с `metadata.{ direction, period,
  closedBy, closedAt }` (PRD 1 docs/payroll-closing-and-accrual, Фаза 2)
- `DELETE /v1/work-schedule/entries/:id` — удалить запись (день возвращается в состояние «не заполнен»);
  та же блокировка закрытого периода, что и у `PUT` выше
- `GET /v1/work-schedule?month=YYYY-MM&departmentId=` (Фаза 3) — таблица «сотрудники × дни месяца»
  отдела одним запросом: по каждому сотруднику — по одной ячейке (`date`, `entryId`, `status`, `hours`,
  `role`, всё `null` у не заполненного дня) на каждый календарный день месяца (28-31), `totalHours` за
  месяц, `vacationDaysUsed`/`vacationDaysLimit` — использованные дни отпуска и годовой лимит (константа
  `ANNUAL_VACATION_DAYS_LIMIT = 31`), считаются за календарный год месяца из запроса, а не только за
  сам месяц. Плюс агрегаты: `days[]` — число людей в смене (`peopleOnShift`) по каждому дню, `totalHours`
  верхнего уровня — общий фонд часов месяца. `departmentId` не передан — сотрудники всех отделов, в
  ответе `departmentId: null`. Ровно два запроса к БД независимо от числа сотрудников/дней (список
  сотрудников + одна выборка записей графика за год)
- `GET /v1/work-schedule/shift?date=YYYY-MM-DD&departmentId=` (Фаза 4) — состав смены на дату для
  мобильного экрана «Отдел сегодня»: `onShift[]` — кто на смене (`employeeId`, `name`, `role`, `hours`,
  `status = WORKING`), `notOnShift[]` — кто нет, сгруппированные по причине отсутствия (`reason`:
  `DAY_OFF`/`TIME_OFF`/`SICK_LEAVE`/`VACATION`/`NOT_FILLED` — сотрудник без записи графика на эту дату
  получает `NOT_FILLED`; группы с пустым `employees` в ответе не отдаются), `roleCounts[]` — счётчики
  ролей среди тех, кто на смене (роли без единого человека в смене не отдаются), `totalHours` —
  суммарные часы дня. Сумма `onShift` + всех `notOnShift[].employees` равна числу сотрудников отдела.
  `departmentId` не передан — сотрудники всех отделов, в ответе `departmentId: null`. Ровно два запроса
  к БД независимо от числа сотрудников (список сотрудников + одна выборка записей графика за день)

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
`ShopSalaryRuleFactory`): `PayPerHour` (`hours × price`, источник часов — общий `WorkScheduleEntry`, Фаза 5),
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
- `POST /v1/shop/accounting/period/:period/close` — закрыть период направления `shop` (`{ closedBy }`); `409` при неутверждённых строках плана продаж этого направления, иначе — сброс кэша, неизменяемый снапшот по каждому сотруднику с личной мотивационной схемой `shop` (или схемой отдела) и в той же транзакции документы начисления `SalaryAccrual` (`DRAFT`, включая нулевые и уволенных с `isDismissed`); после коммита — `SalaryAccrualDocumentsCreatedDomainEvent` направления `shop`. Реализовано отдельным `CloseShopAccountingPeriodHandler`, без общего кода с `service`. Фаза 2 PRD 1 — как у `service`: только истёкший и ещё не закрытый месяц (`409`), перед расчётом неявная синхронизация отгрузок МойСклада с датой в месяце (таймаут 2 мин, блокировка направления от тика `MoySkladSyncCron`), ошибка синка → `409`, ничего не создано
- `GET /v1/shop/accounting/period/:period/close-preview` — сводка окна подтверждения закрытия направления `shop` (`ClosePeriodPreviewResponse`), зеркало сервисного `close-preview`, тем же калькулятором строк, что и `close` магазина
- `POST /v1/shop/accounting/period/:period/reopen` — повторно открыть закрытый период (`{ confirm: true }`): все документы начисления в `DRAFT` → удаляет документы и снапшот; иначе `409` с `metadata.accruals`
- `POST /v1/shop/accounting/period/:period/recalculate` — сбросить кэш открытого периода; `204`, закрытый период — `409`
- `GET /v1/shop/accounting/salary_accruals?period=YYYY-MM` — список документов начисления направления `shop` за период, та же форма, что у сервисного эквивалента (`{ direction: 'shop', period, items, total }`, строки списка — с `accruedLinesCount`); закрытие `service` документов `shop` не создаёт
- `GET /v1/shop/accounting/salary_accruals/:id` — карточка документа начисления `shop` со строками; `404` для документа другого направления
- `POST /v1/shop/accounting/salary_accruals/:id/lines/:lineId/accrue`, `POST .../lines/:lineId/unaccrue`, `PATCH .../lines/:lineId` — проведение/отмена/корректировка строки документа `shop` (Фаза 6 PRD 2): те же контракты, статусы и коды ошибок, что у сервисных эквивалентов выше; тонкие HTTP-контроллеры поверх generic-по-`direction` команд `Accrue/Unaccrue/AdjustSalaryAccrualLineCommand` через общий `CommandBus` (как `reopen`/`recalculate` периода), движения ложатся на общий баланс сотрудника (Фаза 8b)
- `POST /v1/shop/accounting/salary_accruals/:id/accrue`, `POST /v1/shop/accounting/salary_accruals/accrue?period` — массовое проведение по документу и по месяцу для направления `shop` (Фаза 7 PRD 2): те же контракты и семантика, что у сервисных эквивалентов выше; тонкие контроллеры поверх generic-по-`direction` команд `AccrueSalaryAccrualDocumentCommand`/`AccruePeriodSalaryAccrualsCommand` через общий `CommandBus`
- Эндпоинтов баланса под `/v1/shop/accounting/balance/*` больше нет (Фаза 8b): баланс общий по сотруднику, движения документов `shop` ложатся в ту же ленту и читаются общими эндпоинтами `/v1/accounting/balance/*` (см. раздел баланса выше)
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
