## Why

Правило зарплаты «за выполнение задачи» (`TaskCompletion`) целиком построено поверх Bitrix24 Tasks
API: задача создаётся push-запросом (`tasks.task.add`), а факт выполнения узнаётся только через
поллинг раз в 5 минут (`SalaryTaskStatusSyncCron` → `fetchTaskStatusesBatch`, один batch-запрос на
все отслеживаемые задачи разом). На практике это оказалось ненадёжно и непрозрачно:

- одна-единственная задача с «неожиданным» форматом ответа Bitrix24 (например, удалённая) валит
  парсинг всего batch-ответа и останавливает обновление статуса **для всех** задач разом, без
  какого-либо видимого пользователю сигнала (подтверждено живым инцидентом — `cron-errors.log`);
- крон синка тикает только в проде (`@ProdCron`), поэтому в dev/staging задача может не
  синхронизироваться вообще;
- редактирование задачи в iReports (например, описания) никогда не долетает обратно до Bitrix24 —
  обратная запись поддержана только для дедлайна и закрытия;
- до момента, пока Bitrix24-статус не станет «Выполнено», задача нигде не видна в интерфейсе — ни
  ссылки, ни дедлайна, ни индикатора «создана, ждёт выполнения» (это осознанно заложено в текущей
  реализации и подтверждено отдельным разбором UI);
- вся механика зависит от стабильности стороннего REST API и не даёт iReports полноценного
  контроля над жизненным циклом задачи.

Пора завести собственную сущность **Задача** внутри iReports — без Bitrix24 как источника истины,
без поллинга, с задачей, видимой в интерфейсе на всех стадиях её жизни, а не только в момент
выполнения.

## What Changes

- **BREAKING**: полностью удаляется интеграция зарплатного правила `TaskCompletion` с Bitrix24
  Tasks API — push-методы (`BitrixService.createTask/closeTask/updateTaskDeadline`,
  `BitrixTasksGatewayPort`), поллинг (`src/sync/bitrix-tasks/*`,
  `SalaryTaskStatusSyncCron`/`SalaryTaskStatusSyncService`), batch-парсинг статусов
  (`fetchTaskStatusesBatch`, `BitrixBatchTaskStatusResponseSchema`).
- Вводится собственная сущность **Task** — своя таблица, свой CRUD, свой жизненный цикл статусов,
  без зависимости от внешней системы. Источник истины о выполнении — сам iReports.
- Правило `TaskCompletion` переключается с `erpData.taskCompletionStatuses` (заполнялось из
  `SalaryTask`/Bitrix24) на новую локальную сущность Task — начисление реагирует на завершение
  задачи мгновенно, без задержки поллинга и без риска, что синк «сломается» на посторонней задаче.
- Frontend получает полноценный UI задач: создание, список, смена статуса, дедлайн, назначение —
  сама задача видна в интерфейсе на любой стадии своего жизненного цикла, с момента создания, а не
  только после выполнения. Видимость СТРОКИ НАЧИСЛЕНИЯ в зарплатном отчёте не меняется — она по
  прежнему появляется только после перевода задачи в «Выполнено» (см. `service/accounting`).
- Существующие записи `salary_tasks` (Bitrix24 task id, синкнутые статусы) выводятся из
  эксплуатации вместе со всей Bitrix-веткой — конкретный сценарий миграции/переноса данных решается
  в `design.md`.

## Capabilities

Решено: `shop` входит в объём этой итерации вместе с `service` — у него зеркальная, но независимая
по коду интеграция с Bitrix24 (`domains/shop/modules/accounting`), и оставлять его на устаревшей
Bitrix-ветке, пока `service` уже переехал на собственную сущность, создало бы два разных, надолго
разошедшихся способа обслуживать один и тот же продуктовый сценарий. При этом сама сущность
«Задача» — общая (см. New Capabilities ниже): `service/accounting` и `shop/accounting` продолжают
быть независимыми друг от друга (свои Entity/Port/Repository у каждого правила `TaskCompletion`), но
обе ссылаются на один и тот же общий модуль `tasks`, а не заводят каждая свою копию.

### New Capabilities
- `tasks`: собственная сущность «Задача» iReports — **общая для всех направлений бизнеса**
  (`service`, `shop` и последующих), не дублируется отдельной реализацией на каждое направление.
  Создание, статусы жизненного цикла, дедлайн, назначение исполнителя, завершение, привязка к
  зарплатному правилу любого направления. По прецеденту существующих сквозных модулей
  (`src/modules/employee-balance/`, `src/modules/employee-dismissal/` — см. `backend/CLAUDE.md`,
  раздел «Общие таблицы между service и shop», исключения `BalanceTransaction`/`EmployeeDismissal`),
  а не как зеркальная per-domain реализация вроде `SalesPlan`/`SalaryAccrual`.

### Modified Capabilities
- `integrations/bitrix-tasks`: капабилити полностью выводится из эксплуатации — все её требования
  (создание/закрытие задачи в Bitrix24, двусторонняя синхронизация, разовая/регулярная пересоздача,
  общее хранилище) удаляются (REMOVED), т.к. Bitrix24 больше не участвует в жизненном цикле задачи
  зарплатного правила.
- `service/accounting`: точечное терминологическое уточнение — статусная модель задачи стала богаче
  одного терминального статуса «Выполнено» (см. `design.md`, решение 3: шесть статусов с ревью-
  циклом); начисление и видимость строки в отчёте по-прежнему завязаны на ОДИН терминальный статус
  задачи, но теперь называется «Закрыта успешно», а не «Выполнено» (которое стало промежуточным
  статусом — заявление ответственного, ещё не принятое руководителем). Наблюдаемое поведение
  правила (когда именно появляется начисление) не меняется, меняется только имя статуса-триггера.
- `shop/accounting`: то же самое терминологическое уточнение, зеркально.

## Impact

- **Backend, `domains/service/modules/accounting`**: `TaskCompletion` entity (`calculate()`),
  `BuildServiceCalculationContextService`, `task-completion-statuses.builder.ts`,
  `to-salary-report-rules.ts`, `CreateSalaryRuleHandler`/`UpdateMotivationSchemaHandler`
  (создание/обновление задачи при создании/правке правила),
  `EnsureSalaryTaskForPeriodService`/`TaskCompletionAutoCreationCron` (лениво/по расписанию
  создающие задачу нового периода — логика переезжает на новую сущность).
- **Backend, `src/modules/tasks`** (новый сквозной модуль, вне `domains/service`/`domains/shop` — по
  прецеденту `src/modules/employee-balance`/`src/modules/employee-dismissal`): CRUD задач, доменная
  сущность, статусная модель, HTTP-контроллеры, репозиторий — общий для всех направлений.
- **Backend, `src/integrations/bitrix`**: удаляются task-write-методы `BitrixService`
  (`createTask`/`closeTask`/`updateTaskDeadline`), `BitrixTasksGatewayPort`, связанные Zod-схемы
  (`schema.ts`).
- **Backend, `src/sync/bitrix-tasks`**: удаляется целиком (`SalaryTaskStatusSyncCron`,
  `SalaryTaskStatusSyncService`, `cron-errors.log`-логирование этого крона).
- **Prisma**: новая модель `Task` (или аналог) в `prisma/schema/*.prisma`; модель `SalaryTask`
  выводится из эксплуатации — миграция существующих данных решается в `design.md`.
- **Frontend**: `features/SalaryRuleForm/ui/RuleFormCard/ui/TaskCompletionRuleFields.tsx` (форма
  правила — поля, завязанные на Bitrix, заменяются на локальные), `pages/SalaryReportV2/ui/RuleSourcesRail.tsx`
  (сейчас захардкоженный бейдж `DONE`), новый раздел/страница управления задачами.
- **`domains/shop/modules/accounting`**: та же самая замена — `TaskCompletion`/`SalaryTask`,
  `ensure-salary-task-for-period.service.ts`, `task-completion-auto-creation.cron.ts` — ссылается на
  тот же общий модуль `src/modules/tasks`, что и `service` (не собственная реализация).
