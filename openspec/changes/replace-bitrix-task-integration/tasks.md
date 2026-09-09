<!--
  Artifact: tasks
  Requires: proposal, design, architecture, ui-design

  Инструкция для агента:
  - Реализация ведётся по TDD. Для каждой содержательной единицы функциональности
    (юзкейс/сервис на бэкенде, компонент/хук с логикой на фронте) — НЕ для чисто
    визуальной вёрстки без ветвлений/данных/состояний — группа задач состоит из
    4 ОТДЕЛЬНЫХ пунктов чек-листа в этом порядке:
    1. Написать тест(ы) на ожидаемое поведение (из specs/architecture.md) — ДО реализации.
    2. Прогнать эти тесты и зафиксировать, что они падают (red) по ожидаемой причине
       (нет реализации), а не из-за ошибки в самом тесте.
    3. Реализовать функциональность.
    4. Прогнать те же тесты и зафиксировать, что они зелёные (green), и что не
       сломались соседние тесты (регрессия).
  - Не сворачивай эти 4 шага в один пункт — apply отслеживает прогресс по каждому
    чекбоксу отдельно.
  - Для задач без логики (например, статичная вёрстка) шаги 1/2/4 можно опустить,
    но это исключение нужно явно обосновать в тексте задачи 3, а не молча пропустить.
-->

## Решения, зафиксированные перед написанием этого списка

- **RBAC (`tasks:view`/`tasks:manage`, design.md Decision 6, Open Questions)** — пользователь явно
  попросил НЕ вводить permission-guard'ы в рамках этого change ("Пока не ставь гарды, это будет
  отдельный этап"). Ниже НЕТ задач на `@RequirePermissions`/`work-schedule:*`-подобные права,
  условный рендер кнопок по роли/праву на фронте. `ChangeTaskStatusHandler` проверяет только сам
  граф переходов (`TaskStatus.canTransitionTo`, см. specs/tasks/spec.md) — не то, кто именно вызывает
  переход; ролевые варианты UI (`TaskTransitionActions`, `actorRole: 'assignee' | 'manager'`) строятся
  по статусу задачи (какие переходы допустимы из текущего статуса), а не по фактической роли
  залогиненного пользователя. Авторизация — предмет отдельного будущего change.
- **Отклонения ui-design.md от architecture.md** (мобильный Bottom Nav без отдельного таба «Задачи» —
  подсвечивается «Ещё»; ролевые/терминальные состояния карточки статуса не задублированы на мобильном;
  отдельный артборд для «Закрыто неуспешно»/«На доработку» не заводился) — приняты пользователем при
  переходе к этому артефакту, реализуются как описано в ui-design.md.
- **Визуальная проверка экранов в .pen** — в сессии дизайна `TakeScreenshot`/`Export` у Pencil MCP
  переставали рендерить новые узлы; структура всех фреймов проверена через `Get`/`problems`, но не все
  экраны подтверждены скриншотом. Исполнитель фронтенд-задач должен САМ прочитать нужный фрейм через
  `mcp__pencil__execute`/`Get` перед вёрсткой (Node ID указан в каждой задаче) и, если видит там
  реальную проблему компоновки — исправить дизайн в `.pen`, а не молча воспроизводить в коде то, что
  не сходится.

---

## 1. Prisma-модель `Task` и вывод `SalaryTask` из эксплуатации

- [ ] 1.1 Добавить Prisma-модель `Task` в новый файл `backend/prisma/schema/task.prisma` (поля по
      design.md раздел 2: `id`, `direction` nullable, `title`, `description` nullable, `deadline`,
      `assigneeEmployeeId` без FK, `status` string, `closedSuccessfullyAt` nullable, `createdAt`,
      `updatedAt`) и прогнать `npx prisma generate --config prisma.config.ts` — убедиться, что клиент
      сгенерировался без ошибок и модель `Task` доступна в `prisma/generated/prisma/schema`. Задача
      декларативная (схема данных, не бизнес-логика) — тесты не пишутся, обоснование: миграция схемы
      сама по себе не содержит ветвлений.
- [ ] 1.2 Создать и прогнать миграцию (`npx prisma migrate dev --config prisma.config.ts --name
      add-task-model`) — убедиться, что она применяется на dev-БД без ошибок.
- [ ] 1.3 Удалить модель `SalaryTask`/таблицу `salary_tasks` из Prisma-схемы (`prisma/schema/
      salary.prisma` или где она сейчас определена) отдельной миграцией — по design.md Migration Plan
      данные непригодны для переноса (привязаны к Bitrix task id), объём — единицы тестовых строк.
      Прогнать `prisma migrate dev` и убедиться, что миграция применяется на dev-БД.

## 2. `src/modules/tasks` — доменный слой (TDD)

- [ ] 2.1 Написать тесты на `TaskStatus` VO: полный граф переходов из specs/tasks/spec.md
      (`NEW→IN_PROGRESS→DONE→{CLOSED_SUCCESSFULLY,CLOSED_UNSUCCESSFULLY,REWORK}`,
      `REWORK→IN_PROGRESS`, отклонение любого перехода не из этого списка, отсутствие переходов из
      `CLOSED_SUCCESSFULLY`/`CLOSED_UNSUCCESSFULLY`) в
      `backend/src/modules/tasks/domain/value-objects/task-status.value-object.spec.ts`.
- [ ] 2.2 Прогнать тесты из 2.1 (`npm run test -- task-status.value-object`) и зафиксировать red —
      класса `TaskStatus` ещё нет.
- [ ] 2.3 Реализовать `TaskStatus` VO (`domain/value-objects/task-status.value-object.ts`,
      `canTransitionTo(next: TaskStatus): boolean`, `isTerminal(): boolean`) поверх
      `value-object.base.ts`.
- [ ] 2.4 Прогнать тесты из 2.1 и зафиксировать green, без регрессий в соседних тестах модуля.

- [ ] 2.5 Написать тесты на `Task` entity в
      `backend/src/modules/tasks/domain/entities/task.entity.spec.ts`: `Task.create(...)` стартует в
      `NEW`; `transitionTo(next, actorEmployeeId)` бросает `InvalidTaskTransitionException` на
      недопустимом переходе (по графу `TaskStatus`) и применяет допустимый; `transitionTo` в
      `CLOSED_SUCCESSFULLY` проставляет `closedSuccessfullyAt`, любой другой переход — нет;
      `cancelForRuleDeletion()` переводит в `CLOSED_UNSUCCESSFULLY` из любого нетерминального статуса
      и является no-op, если статус уже терминальный (оба варианта: уже `CLOSED_SUCCESSFULLY` и уже
      `CLOSED_UNSUCCESSFULLY`) — по specs/tasks/spec.md, сценарии «Отмена правила закрывает
      незавершённую задачу...».
- [ ] 2.6 Прогнать тесты из 2.5 и зафиксировать red.
- [ ] 2.7 Реализовать `Task` entity (`domain/entities/task.entity.ts`, поля по design.md раздел 2,
      методы `create`/`transitionTo`/`cancelForRuleDeletion`) и исключение
      `InvalidTaskTransitionException` (`domain/exceptions/`, наследник
      `src/shared/exceptions/exception.base.ts`, код в `exception.codes.ts`).
- [ ] 2.8 Прогнать тесты из 2.5 и зафиксировать green, без регрессий.

## 3. `src/modules/tasks` — порт и Prisma-репозиторий (TDD)

- [ ] 3.1 Написать тесты на `TaskRepository` (Prisma-реализация `TaskRepositoryPort`) —
      `insert`/`update` персистят агрегат корректно (включая переживание `transitionTo` — статус,
      `closedSuccessfullyAt`), `findManyByIds([...])` возвращает только запрошенные и существующие id
      (по прецеденту существующих repository-тестов модуля, см. `work-schedule-entry.repository.ts`
      как образец теста поверх тестовой БД), `findById`/`findMany` с фильтром по `status`/`direction`
      для списка `/tasks`.
- [ ] 3.2 Прогнать тесты из 3.1 и зафиксировать red — репозитория ещё нет.
- [ ] 3.3 Реализовать `TaskRepositoryPort` (`application/ports/task.repository.port.ts`) и
      `TaskRepository` (`infrastructure/repositories/task.repository.ts`) + маппер
      Entity↔Prisma-модель (`infrastructure/mappers/task.mapper.ts`).
- [ ] 3.4 Прогнать тесты из 3.1 и зафиксировать green, без регрессий.

## 4. `src/modules/tasks` — CQRS use-cases (TDD)

- [ ] 4.1 Написать тесты на `CreateTaskHandler` (`{title, description?, deadline,
      assigneeEmployeeId, direction?}` → `Task.create()` + `repo.insert()`, возвращает `{id}`; НЕ
      принимает и не сохраняет `salaryRuleId`/`period` — по specs/tasks/spec.md «Задача — полностью
      самостоятельная сущность») в
      `backend/src/modules/tasks/application/command/create-task/create-task.handler.spec.ts`.
- [ ] 4.2 Прогнать и зафиксировать red.
- [ ] 4.3 Реализовать `CreateTaskCommand`/`CreateTaskHandler` (`application/command/create-task/`).
- [ ] 4.4 Прогнать и зафиксировать green, без регрессий.

- [ ] 4.5 Написать тесты на `ChangeTaskStatusHandler` (`{taskId, targetStatus, actorEmployeeId}` →
      находит `Task`, вызывает `transitionTo`, персистит; пробрасывает
      `InvalidTaskTransitionException` наружу без изменения состояния при недопустимом переходе) в
      `application/command/change-task-status/change-task-status.handler.spec.ts`.
- [ ] 4.6 Прогнать и зафиксировать red.
- [ ] 4.7 Реализовать `ChangeTaskStatusCommand`/`ChangeTaskStatusHandler`.
- [ ] 4.8 Прогнать и зафиксировать green, без регрессий.

- [ ] 4.9 Написать тесты на `CancelTaskForRuleDeletionService.cancel(taskId)` (находит `Task` по id,
      вызывает `cancelForRuleDeletion()`, персистит; no-op на уже терминальной задаче — персистентность
      не трогается лишний раз или трогается идемпотентно) в
      `application/services/cancel-task-for-rule-deletion.service.spec.ts`.
- [ ] 4.10 Прогнать и зафиксировать red.
- [ ] 4.11 Реализовать `CancelTaskForRuleDeletionService`.
- [ ] 4.12 Прогнать и зафиксировать green, без регрессий.

- [ ] 4.13 Написать тесты на `ListTasksService`/`GetTaskService` (фильтрация списка по
      `status`/`direction`, постраничность/сортировка — по тому, что реально нужно `pages/Tasks`
      согласно ui-design.md; `GetTaskService` — 404/`NotFoundException`, если `taskId` не существует)
      в `application/services/list-tasks.service.spec.ts` и `get-task.service.spec.ts`.
- [ ] 4.14 Прогнать и зафиксировать red.
- [ ] 4.15 Реализовать `ListTasksService`/`GetTaskService`.
- [ ] 4.16 Прогнать и зафиксировать green, без регрессий.

## 5. `src/modules/tasks` — HTTP-интерфейс и подключение модуля

- [ ] 5.1 Создать zod-схемы запросов (`interface/dto/`, `nestjs-zod`, `createZodDto`) для
      `POST /v1/tasks`, `GET /v1/tasks` (query: `status?`, `direction?`), `GET /v1/tasks/:id`,
      `PATCH /v1/tasks/:id/status` — типы согласовать с `ireports-contracts` (добавить/обновить схему
      задачи в `contracts/` первым шагом, если она нужна и фронту, и бэкенду).
- [ ] 5.2 Реализовать HTTP-контроллеры (`interface/http-controllers/`) с `@ApiTags('Задачи')`,
      `@ApiOperation` на каждом методе (по-русски, см. `backend/CLAUDE.md`) — каждый диспатчит
      соответствующую команду/сервис из группы 4.
- [ ] 5.3 Создать `TasksModule` (`src/modules/tasks/tasks.module.ts`) — регистрирует CQRS-хендлеры на
      общем `CqrsModule`, экспортирует `TASK_REPOSITORY` порт; подключить в `app.module.ts` и в
      `include` `commonDocument` в `src/config/swagger.config.ts` (по прецеденту сквозных модулей —
      см. `backend/CLAUDE.md`, раздел про подключение нового модуля в Swagger UI).
- [ ] 5.4 Обновить `ENDPOINTS.md` — добавить раздел с 4 новыми эндпоинтами `src/modules/tasks`.
- [ ] 5.5 Написать/прогнать e2e-тест `src/modules/tasks` (create → get → list с фильтром → transition
      через полный граф статусов → transition из терминального статуса отклоняется 4xx) — по образцу
      существующих e2e-спеков модулей (`test/jest-e2e.json`). Зафиксировать, что e2e зелёный.

## 6. `domains/service/modules/accounting` — переключение `TaskCompletion` на новую сущность (TDD)

- [ ] 6.1 Обновить `TaskCompletionSalaryConfig` (`domain/types/salary-rule.types.ts`): убрать
      `bitrixTaskTitle`/`taskDescription`, добавить `taskIdByPeriod: Record<string, string>`,
      `taskTitleTemplate`, `taskDescriptionTemplate` (по design.md раздел 4 «Шаблонные поля»);
      обновить контракт `SalaryRuleRequest` в `ireports-contracts`, если поля конфига там
      зафиксированы. Чисто структурное изменение типа — тесты не пишутся здесь отдельно, они
      появляются вместе с задачами ниже, которые реально используют новые поля.
- [ ] 6.2 Написать тесты на `SalaryTask` entity (`SalaryTask.create({taskId, status})`,
      `isCompleted()` возвращает `true` только для `status === 'CLOSED_SUCCESSFULLY'`) в
      `domain/entities/salary-task/salary-task.entity.spec.ts` — по design.md решение 5.
- [ ] 6.3 Прогнать и зафиксировать red.
- [ ] 6.4 Реализовать `SalaryTask` entity.
- [ ] 6.5 Прогнать и зафиксировать green, без регрессий.

- [ ] 6.6 Обновить существующие тесты `task-completion-statuses.builder.ts` (или написать новые, если
      их не было) на новое поведение: собирает `taskId` из `config.taskIdByPeriod[period]` каждого
      `TaskCompletion`-правила, вызывает `TASK_REPOSITORY.findManyByIds()` напрямую, строит
      `SalaryTask.create(...)` и кладёт в `erpData.taskCompletionStatuses` по `ruleId`; правило без
      `taskIdByPeriod[period]` — не попадает в карту (эквивалент прежнего «задача не заведена»).
- [ ] 6.7 Прогнать эти тесты и зафиксировать red по причине несовпадения с новой реализацией.
- [ ] 6.8 Реализовать изменение `task-completion-statuses.builder.ts` — заменить обращение к
      Bitrix/`SalaryTask`-репозиторию на прямой вызов `TASK_REPOSITORY.findManyByIds()` (инжект порта
      из `src/modules/tasks` в `accounting.module.ts`).
- [ ] 6.9 Прогнать тесты из 6.6 и зафиксировать green, без регрессий в остальных тестах
      `build-service-calculation-context.service.spec.ts`.

- [ ] 6.10 Обновить `create-salary-rule.handler.spec.ts`/`create-salary-rule.handler.ts`: убрать
      любой вызов в Bitrix/`tasks` при создании правила `TaskCompletion` — `taskId` приходит в теле
      запроса как часть `config` и просто сохраняется в `config.taskIdByPeriod[текущийПериод]` как
      часть уже существующего локального `insert(rule)` (design.md решение 4, шаг 2). Дописать тест на
      это поведение, если его ещё нет, прогнать red → реализовать → green (стандартный TDD-цикл,
      объединён в один пункт задачи, т.к. это точечное изменение уже покрытого тестами хендлера — при
      реализации всё равно прогнать red перед правкой и green после).
- [ ] 6.11 Обновить `TaskCompletion.calculate()` (`domain/entities/salary-rules/task-completion.entity.ts`)
      — заменить `entry.status.isDone()` на `entry.isCompleted()` (метод `SalaryTask` из 6.4).
      Обновить/дописать unit-тест правила на то, что `calculate()` возвращает `CalculationLine` только
      когда `SalaryTask.isCompleted() === true` (т.е. `CLOSED_SUCCESSFULLY`), и `null` для остальных 5
      статусов — прогнать red перед правкой, green после.
- [ ] 6.12 Реализовать `EnsureRuleTaskForPeriodService` (`application/services/`, новый) — написать
      тесты по псевдокоду design.md раздел 4: `ensure(rule, period, assigneeEmployeeId)` возвращает
      существующий `taskId` из `config.taskIdByPeriod[period]`, если есть (идемпотентность); если
      `!config.isRecurring` — возвращает `null`; иначе вычисляет дедлайн по `deadlineTemplate`,
      диспатчит `CreateTaskCommand` через `CommandBus` (используя `taskTitleTemplate`/
      `taskDescriptionTemplate`), сохраняет `taskId` в `config.taskIdByPeriod[period]` через
      `salaryRuleRepo.update(rule)`. Прогнать red → реализовать → прогнать green.
- [ ] 6.13 Подключить вызов `EnsureRuleTaskForPeriodService.ensure(...)` в
      `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService` (тот же триггер, что раньше
      был у `TaskCompletionAutoCreationCron`/эквивалента) — обновить/дописать тесты этих сервисов,
      прогнать red → реализовать → green, включая регрессию по остальным типам правил (`PayPerHour`,
      `ServiceCompleted`, `OrderPayed` не должны быть затронуты).
- [ ] 6.14 Подключить `CancelTaskForRuleDeletionService` (из `src/modules/tasks`, группа 4) к удалению/
      отмене `TaskCompletion`-правила в `service/accounting` — найти существующий хендлер удаления
      правила, дописать тест «удаление `TaskCompletion`-правила с незавершённой задачей вызывает
      `cancelForRuleDeletion`, с уже терминальной — не вызывает лишних побочных эффектов», прогнать
      red → реализовать → green.

## 7. `domains/shop/modules/accounting` — зеркальное переключение (TDD)

- [ ] 7.1 Повторить задачи 6.1–6.14 для `domains/shop/modules/accounting` — независимая реализация
      (свой `SalaryTask`, свой `task-completion-statuses.builder.ts`, свой
      `EnsureRuleTaskForPeriodService`), но ссылается на тот же `TASK_REPOSITORY`/`CommandBus`
      `src/modules/tasks`, что и `service` (см. `backend/CLAUDE.md`, независимость доменов при общей
      сущности `tasks`). Каждый под-пункт — свой red→green цикл, аналогично группе 6, тесты кладутся
      в соответствующие файлы `domains/shop/modules/accounting/...`.

## 8. Удаление интеграции Bitrix24 Tasks (BREAKING, cleanup)

- [ ] 8.1 Удалить `src/integrations/bitrix`: методы `BitrixService.createTask`/`closeTask`/
      `updateTaskDeadline`, `BitrixTasksGatewayPort` и связанные Zod-схемы (`schema.ts`) — убедиться,
      что после удаления `npm run build` (tsc) проходит без ошибок неразрешённых импортов.
- [ ] 8.2 Удалить `src/sync/bitrix-tasks` целиком (`SalaryTaskStatusSyncCron`,
      `SalaryTaskStatusSyncService`) — убрать импорт модуля из `app.module.ts`, прогнать `npm run
      build`.
- [ ] 8.3 Удалить старый `TaskCompletionAutoCreationCron` (или его прежний эквивалент, если он был
      привязан к Bitrix-поллингу) в обоих доменах — заменён в группе 6/7 синхронным
      `EnsureRuleTaskForPeriodService`, вызываемым при открытии отчёта. Прогнать `npm run build` и
      полный `npm run test`, убедиться, что ничего не ссылается на удалённые классы.
- [ ] 8.4 Пройтись по `src/app.module.ts` — обновить комментарии `TODO: не мигрировано...`, если они
      упоминали Bitrix Tasks/`salary_tasks`, актуализировать под новое состояние.

## 9. Контракты (`ireports-contracts`)

- [ ] 9.1 Добавить/обновить Zod-схемы: `Task` (ответ API), `TaskStatus` enum (6 значений),
      `CreateTaskRequest`, `ChangeTaskStatusRequest`, обновлённый `TaskCompletionSalaryConfig`
      (`taskIdByPeriod` не выставляется наружу как редактируемое поле формы — только читается;
      `taskTitleTemplate`/`taskDescriptionTemplate`/`deadlineTemplate`/`defaultAmount` — редактируемые).
      Прогнать типизацию контрактов (`tsc --noEmit` в `contracts/`, если есть отдельный скрипт) —
      убедиться, что и backend, и frontend компилируются против новых типов после обновления
      workspace-зависимости.

## 10. Frontend — `shared/ui-kit` — `TaskStatusBadge` (TDD)

- [ ] 10.1 Написать тест на маппинг `TaskStatusCode → {label, ...}` в `TaskStatusBadge` (6 значений
      из specs/tasks/spec.md → 6 подписей/цветовых вариантов, ровно как заведено в
      `design/sallary-first-iteration.pen`: `NEW`→нейтральный, `IN_PROGRESS`→info, `DONE`→warning,
      `CLOSED_SUCCESSFULLY`→success, `CLOSED_UNSUCCESSFULLY`→danger, `REWORK`→violet, см. таблицу
      «Экраны» ui-design.md, узел `iZrrX`) — компонентный/юнит-тест на чистую функцию маппинга статус
      → вариант, не на весь рендер.
- [ ] 10.2 Прогнать и зафиксировать red.
- [ ] 10.3 Реализовать обновление `TaskStatusBadge` (существующий, `shared/ui-kit/atoms/`) — 6 значений
      вместо захардкоженного `"DONE"`.
- [ ] 10.4 Прогнать и зафиксировать green, без регрессий там, где `TaskStatusBadge` уже используется.

## 11. Frontend — `features/CreateTask` (TDD)

- [ ] 11.1 Написать тесты на `useCreateTask` (`model/api.ts` — mutation на `POST /v1/tasks`,
      обработка `ApiError` в `.catch()`) — по прецеденту существующих мутаций фичи (см.
      `features/SalaryRuleForm/service/model/api.ts` как образец теста query options factory).
- [ ] 11.2 Прогнать и зафиксировать red.
- [ ] 11.3 Реализовать `useCreateTask` и `CreateTaskForm` (`ui/`) — форма: заголовок, описание,
      дедлайн, ответственный (селект сотрудника); публичный API фичи — только через `index.ts`.
- [ ] 11.4 Прогнать и зафиксировать green.

## 12. Frontend — `features/TaskStatusControl` (TDD)

- [ ] 12.1 Написать тесты на `useTask`/`useTaskTransition` (`model/api.ts` — query options factory
      для `GET /v1/tasks/:id`, mutation для `PATCH /v1/tasks/:id/status`) и на логику
      `TaskTransitionActions` — какие кнопки показываются для каждого статуса задачи (по specs/
      tasks/spec.md: из `NEW`/`IN_PROGRESS` — переход вперёд по цепочке ответственного; из `DONE` —
      3 действия проверки руководителя; из `REWORK` — «вернуть в работу»; из `CLOSED_*` — ни одной
      кнопки). Компонент читает набор допустимых действий из статуса, а не из отдельно переданной
      роли (см. решение про RBAC в начале файла).
- [ ] 12.2 Прогнать и зафиксировать red.
- [ ] 12.3 Реализовать `useTask`, `useTaskTransition`, `TaskTransitionActions`, публичный
      `TaskStatusControl` (`index.ts`) — визуальная структура карточки (статус-бейдж, описание,
      дедлайн, ответственный, блок действий) — по фрейму `kf1uq` (десктоп, вариант «В работе») в
      `design/sallary-first-iteration.pen`, прочитать точную структуру через `mcp__pencil__execute`/
      `Get` перед вёрсткой; варианты для статуса `DONE` — по фрейму `QpFcx`, для терминальных
      статусов — по фрейму `yZE5X`; мобильный вариант — по фрейму `cmZjM` (⚠️ см. предупреждение в
      начале файла про непроверенный рендер этого фрейма — перечитать структуру и визуально
      перепроверить компоновку панели листа перед вёрсткой, а не копировать вслепую).
- [ ] 12.4 Прогнать и зафиксировать green.

## 13. Frontend — `pages/Tasks` (новая страница) (TDD)

- [ ] 13.1 Написать тесты на `useTasksPage` (`model/useTasksPage.ts`) — плоский стейт-хук:
      `tasks`/`isInitialLoad`/`isRefreshing`/`statusFilter`/`setStatusFilter` и аналогичный фильтр по
      направлению; смена фильтра не «схлопывает» уже отрисованный список (переиспользовать паттерн
      `isInitialLoad`/`isRefreshing`, уже применяемый в других списковых страницах проекта).
- [ ] 13.2 Прогнать и зафиксировать red.
- [ ] 13.3 Реализовать `useTasksPage`, `tasksApi.list` (`model/api.ts`), `TaskList` (`ui/`) — по
      фрейму `iZrrX` (десктоп, список — читать структуру через `mcp__pencil__execute`/`Get` перед
      вёрсткой: топнав с новым пунктом «Задачи», page header, filter bar с двумя чипами и поиском,
      таблица с 6 колонками). Пустое состояние (нет задач по фильтру) — по фрейму `cHCoj`. Мобильная
      версия — по фрейму `JlkUN` (App Bar/Bottom Nav с подсвеченным пунктом «Ещё», карточки вместо
      строк таблицы, см. «Отклонения» в ui-design.md).
- [ ] 13.4 Прогнать и зафиксировать green, включая регрессионную проверку роутинга (`/tasks`
      добавлен в `src/config/app.routes.ts`-эквивалент фронтенда, страница открывается).

## 14. Frontend — `SalaryRuleDetail` — 2-шаговый мастер создания `TaskCompletion`-правила (TDD)

- [ ] 14.1 Написать тесты на `useCreateTaskCompletionRuleWizard` (`pages/SalaryRuleDetail/mediator/
      model/`) — оркестрация `useCreateTask` (группа 11) + существующего `useSalaryRuleForm`:
      `step`/`createdTaskId`/`goToRuleStep`; переход на шаг 2 возможен только после успешного
      создания задачи на шаге 1 (есть `createdTaskId`); мастер сам не содержит бизнес-логики создания
      ни задачи, ни правила — только композицию двух готовых хуков.
- [ ] 14.2 Прогнать и зафиксировать red.
- [ ] 14.3 Реализовать `useCreateTaskCompletionRuleWizard` и `CreateTaskCompletionRuleWizard.tsx`
      (`pages/SalaryRuleDetail/mediator/`) — без условного рендера внутри самого mediator-компонента
      (ветвление шага — в презентационном компоненте, по правилу проекта из architecture.md). Шаг 1 —
      по фрейму `FwNov` (десктоп) в `.pen`-файле — читать точную структуру формы (название, описание,
      дедлайн, ответственный, направление) через `mcp__pencil__execute`/`Get` перед вёрсткой. Шаг 2 —
      по фрейму `EdCuh` (вариант «Регулярная») — карточка-ссылка на уже созданную задачу (readonly),
      название правила, роль, `Period Tabs` («Разовая»/«Регулярная»), условно видимый блок шаблона
      автосоздания (заголовок/описание/дедлайн-шаблон — только при «Регулярная», см. «Ключевые
      состояния» ui-design.md), сумма начисления по умолчанию.
- [ ] 14.4 Прогнать и зафиксировать green.

- [ ] 14.5 Обновить `TaskCompletionRuleFields.tsx` (`features/SalaryRuleForm/ui/RuleFormCard/ui/`) —
      написать/обновить тест на то, что поле `taskId` теперь ОБЯЗАТЕЛЬНЫЙ readonly-параметр (приходит
      от мастера из шага 1, не вводится текстом), поля `taskTitleTemplate`/`taskDescriptionTemplate`/
      `deadlineTemplate` — отдельные самостоятельные поля формы, видимые только при
      `isRecurring === true`. Прогнать red → реализовать → green.
- [ ] 14.6 Подключить `CreateTaskCompletionRuleWizard` в существующий флоу `SalaryRuleDetail` —
      создание правила типа `TaskCompletion` открывает мастер вместо прежней прямой формы; для
      остальных типов правил (`PayPerHour`/`ServiceCompleted`/`OrderPayed`) поведение не меняется —
      прогнать регрессионные тесты `SalaryRuleForm`/`SalaryRuleDetail`, зафиксировать отсутствие
      регрессии.

## 15. Frontend — `SalaryReportV2` — убрать захардкоженный статус

- [ ] 15.1 Написать/обновить тест `RuleSourcesRail.tsx` (`pages/SalaryReportV2/ui/`) — бейдж статуса
      строки берёт реальный `TaskStatusCode` из данных строки расчёта, а не захардкоженный `"DONE"`.
- [ ] 15.2 Прогнать и зафиксировать red.
- [ ] 15.3 Реализовать замену — прокинуть реальный статус задачи из ответа API
      (`salary_report`/`salaryReport`) в `RuleSourcesRail`, использовать обновлённый `TaskStatusBadge`
      (группа 10). Новый артборд не нужен — разметка не меняется (см. ui-design.md).
- [ ] 15.4 Прогнать и зафиксировать green, без регрессий остального отчёта.

## 16. Сквозная проверка

- [ ] 16.1 Прогнать `npm run test` (backend) и `npm run test`/эквивалент (frontend) целиком —
      зафиксировать отсутствие regressions вне модулей, тронутых этим change.
- [ ] 16.2 Прогнать `npm run test:e2e` (backend) — зафиксировать зелёный прогон, включая e2e из
      группы 5.
- [ ] 16.3 Ручной сквозной сценарий (или e2e, если получится автоматизировать без /v1/tasks-мока):
      создать задачу → создать регулярное правило `TaskCompletion` со ссылкой на неё → перевести
      задачу `NEW→IN_PROGRESS→DONE` (от лица ответственного) → перевести `DONE→CLOSED_SUCCESSFULLY`
      (от лица руководителя) → убедиться, что строка начисления по правилу появляется в отчёте
      сотрудника только на этом шаге, а не раньше (spec: service/accounting#requirement-правило-за-
      выполнение-задачи-не-видно-в-прогнозе-до-выполнения) → открыть отчёт за новый период →
      убедиться, что для регулярного правила автоматически создалась новая задача
      (`EnsureRuleTaskForPeriodService`) и она видна в `/tasks`.
- [ ] 16.4 Обновить `backend/src/domains/service/CLAUDE.md`/`backend/CLAUDE.md` (карта «модуль →
      где в коде»), если реализация внесла отклонения от того, что зафиксировано в architecture.md/
      design.md (новые файлы, отличающиеся от указанных путей) — держать документацию синхронной с
      кодом на момент завершения change.
