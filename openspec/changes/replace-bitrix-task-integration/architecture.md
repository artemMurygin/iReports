# Architecture: replace-bitrix-task-integration

## Scope

Новый сквозной backend-модуль `src/modules/tasks` (сущность «Задача», общая для `service`/`shop`),
подключение к нему `TaskCompletion`-правила в `domains/service/modules/accounting` и
`domains/shop/modules/accounting`, полное удаление Bitrix24 Tasks-интеграции
(`src/integrations/bitrix` task-методы, `src/sync/bitrix-tasks`), и новый frontend-раздел задач +
обновление формы зарплатного правила/отчёта.

---

## Backend — Domain Model

### Entities

| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `Task` | new | да | `id`, `direction` (nullable, tag), `title`, `description`, `deadline`, `assigneeEmployeeId`, `status` (VO `TaskStatus`), `closedSuccessfullyAt`, `createdAt`, `updatedAt` | Полностью доменно-агностичная сущность «Задача» модуля `tasks` — НЕ знает про `SalaryRule`/`salaryRuleId`/`period`/`isRecurring` (пересмотрено пользователем, см. `design.md` решение 2/4). Единственный владелец CRUD и жизненного цикла статуса |
| `TaskCompletion` | existing (модифицируется `calculate()` + `config`) | нет (VO-подобная сущность зарплатного правила, `SalaryRule`) | `id`, `name`, `targetRole`, `config` (`TaskCompletionSalaryConfig`, добавляется `taskIdByPeriod: Record<period, taskId>` и шаблонные поля для автосоздания) | Зарплатное правило «за выполнение задачи»; знает `taskId` только через свой собственный `config` — сам решает, какая задача относится к какому периоду, `tasks` в этом решении не участвует |
| `SalaryTask` | new, **по одному независимому классу в `service` и `shop`** | нет (не персистентная, не агрегат — эфемерная сущность расчёта) | `taskId` (identity), `status` (сырой `string`, из данных `tasks`, не через `TaskStatus` VO модуля `tasks`) | **Пересмотрено пользователем** (дважды — сначала предлагался VO+Port/Adapter, отклонено как избыточное): доменная Entity `accounting`, создаётся напрямую в момент получения данных из БД (`task-completion-statuses.builder.ts`, без класса-адаптера/маппера). Метод `isCompleted(): boolean` incapsulates бизнес-правило accounting — какой статус задачи считается «выполненным» для начисления (см. `design.md` решение 5) |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `Task` | `Task` | `TaskStatus` (VO) | Переход статуса только по разрешённому графу (`design.md`, решение 3); из терминального статуса (`CLOSED_SUCCESSFULLY`/`CLOSED_UNSUCCESSFULLY`) переходов нет. Идемпотентность «одна задача на правило за период» — уже НЕ инвариант `Task` (нет `salaryRuleId`/`period`), это инвариант `SalaryRule.config.taskIdByPeriod` — карта в JSON, а не отдельный unique-индекс |

### Value Objects

| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `TaskStatus` | `code` (`NEW`\|`IN_PROGRESS`\|`DONE`\|`CLOSED_SUCCESSFULLY`\|`CLOSED_UNSUCCESSFULLY`\|`REWORK`) | Ограниченный набор значений + ограниченный набор переходов между ними (`canTransitionTo`) — ровно тот случай, где VO обязателен по правилам проекта, а не голый `string`. Принадлежит модулю `tasks`, `accounting` этот класс не импортирует |
| `Period` | (переиспользуется существующий `src/shared/domain/period.value-object.ts`) | existing — не заводим новый; используется только на стороне `accounting` (`Task` больше не хранит период) |

### Services

| Service | Слой (application/domain/infrastructure) | Ответственность |
|---|---|---|
| `TaskRepository` | infrastructure (`src/modules/tasks`) | Prisma-реализация `TaskRepositoryPort` — единственная, общая для `service`/`shop` |
| `CreateTaskHandler` | application, CQRS (`src/modules/tasks`) | Создаёт самостоятельную `Task` — публичный use-case модуля `tasks`, ЕДИНСТВЕННЫЙ вход для создания задачи: используется и напрямую с фронта (`POST /v1/tasks`), и `accounting`-ом при авто-пересоздании на новый период (через `CommandBus`, не отдельный приватный сервис только для `accounting`) |
| `ChangeTaskStatusHandler` | application, CQRS (`src/modules/tasks`) | Валидирует и применяет переход статуса — используется и self-service действиями (ответственный/руководитель), и системным переходом при удалении правила |
| `CancelTaskForRuleDeletionService` | application (`src/modules/tasks`) | При удалении/отмене `TaskCompletion`-правила переводит незавершённую задачу в `CLOSED_UNSUCCESSFULLY` — вызывается из `accounting` с уже известным `taskId` (из `config.taskIdByPeriod`), не ищет задачу сам |
| `ListTasksService` / `GetTaskService` | application (`src/modules/tasks`) | Чтение списка/одной задачи для UI — не зависит от зарплатного отчёта |
| `EnsureRuleTaskForPeriodService` | application (`domains/{service,shop}/modules/accounting`, new, по одному классу на домен — **переехал из `tasks` в `accounting`**) | Идемпотентно возвращает/создаёт `taskId` для регулярного правила на новый период: смотрит `config.taskIdByPeriod[period]`, если нет — диспатчит `CreateTaskCommand` через `CommandBus` и сохраняет результат в `config` локальным `update(rule)`. Единственное оставшееся межмодульное обращение `accounting → tasks` (см. `design.md` решение 4) |
| `task-completion-statuses.builder.ts` | application (`domains/{service,shop}/modules/accounting`, existing, модифицируется) | Собирает `taskId` из `config.taskIdByPeriod[period]` каждого `TaskCompletion`-правила, вызывает `TASK_REPOSITORY.findManyByIds()` напрямую (без Port/Adapter), для каждого результата сразу конструирует `SalaryTask.create({ taskId, status })`, строит `erpData.taskCompletionStatuses` по `ruleId` |
| `TaskCompletion.calculate()` | domain (`domains/{service,shop}/modules/accounting`, existing, модифицируется) | `entry.status.isDone()` → `entry.isCompleted()` (метод `SalaryTask`, не чужого VO), остальная логика без изменений |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `TaskRepositoryPort.findManyByIds` | `ids: string[]` | `Promise<Task[]>` | Метод модуля `tasks` — вызывается напрямую `task-completion-statuses.builder.ts` (accounting), без промежуточного Port/Adapter; чистый lookup по id, без знания о правилах/периодах |
| `TaskRepositoryPort.insert` / `.update` | `task: Task` | `Promise<void>` | Персистентность агрегата |
| `CreateTaskCommand`/`CreateTaskHandler.execute` | `{ title, description, deadline, assigneeEmployeeId, direction? }` | `Promise<{ id: string }>` | HTTP-вход `POST /v1/tasks` (фронт создаёт первую задачу правила вручную) И вход по `CommandBus` (`EnsureRuleTaskForPeriodService` — авто-пересоздание для регулярного правила на новый период). НЕ принимает и не знает про `salaryRuleId`/`period` |
| `EnsureRuleTaskForPeriodService.ensure` | `rule: SalaryRule`, `period: string`, `assigneeEmployeeId: number` | `Promise<string \| null>` | `null`, если правило разовое (как и раньше); иначе возвращает существующий или новый `taskId`, попутно обновляя `rule.config.taskIdByPeriod` локальным `update()` — живёт в `accounting`, не в `tasks` |
| `SalaryTask.create` | `{ taskId: string, status: string }` | `SalaryTask` | Фабрика — вызывается прямо в `task-completion-statuses.builder.ts`, сразу после получения `Task[]` от `TASK_REPOSITORY` |
| `SalaryTask.isCompleted` | — | `boolean` | Бизнес-правило accounting: `this.status === 'CLOSED_SUCCESSFULLY'` — локально описано в `accounting`, не делегируется в `tasks` |
| `Task.transitionTo` | `next: TaskStatus`, `actorEmployeeId: number` | `void` (бросает `InvalidTaskTransitionException`) | Доменный метод — единственное место проверки графа переходов |
| `Task.cancelForRuleDeletion` | — | `void` (no-op, если уже терминальный статус) | Системный переход в `CLOSED_UNSUCCESSFULLY` |
| `ChangeTaskStatusCommand`/`Handler.execute` | `{ taskId, targetStatus, actorEmployeeId }` | `Promise<void>` | HTTP-вход для self-service переходов ответственного/руководителя |
| `TaskCompletion.calculate` | `context: CalculationContext` | `CalculationLine \| null` | Без изменений сигнатуры — меняется только условие внутри (`entry.isCompleted()`) |

---

## Frontend — UI Model

### Pages

| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| `Tasks` | `/tasks` | `ui/` (список + фильтр по статусу/направлению) + `model/useTasksPage.ts` (один stateful-виджет — список, без mediator) | Новая страница — список всех задач, видимых независимо от зарплатного отчёта (реализует `Requirement: Задача видна в интерфейсе на любой стадии жизненного цикла`) |
| `SalaryRuleDetail` | `/salary-rules/:id` (существующий) | **создание правила `TaskCompletion` становится 2-шаговым мастером** — `mediator/CreateTaskCompletionRuleWizard.tsx` (новый, оркеструет 2 stateful-виджета: шаг 1 создание задачи, шаг 2 форма правила с уже известным `taskId`; без условного рендера в самом mediator, ветвление шага — в презентационном компоненте по правилу проекта) | Модифицируется: пользователь СНАЧАЛА создаёт задачу (`POST /v1/tasks`, форма из `features/TaskStatusControl`/новой `features/CreateTask`), затем создаёт правило, уже зная `taskId` (`POST /v1/service/motivation-schema`, отдельный, НЕ единый с созданием задачи, запрос) — см. `design.md`, решение 4 |
| `SalaryReportV2` | `/salaries/*` (существующий) | без изменений слоистости | Модифицируется: `RuleSourcesRail.tsx` — убирается захардкоженный `<TaskStatusBadge status="DONE" />`, статус берётся из реальных данных строки |

### Features (переиспользуемые модули с бизнес-логикой)

| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `TaskStatusControl` | new | `TaskStatusControl` (карточка задачи: статус + доступные действия перехода) | `useTask`, `useTaskTransition` (`model/api.ts`, `queryOptions`/mutation) | Переиспользуемый блок «статус задачи + кнопки перехода» — используется и на странице `/tasks`, и в карточке правила `SalaryRuleDetail` |
| `CreateTask` | new | `CreateTaskForm` (форма: заголовок/описание/дедлайн/ответственный → создаёт задачу, возвращает `taskId`) | `useCreateTask` (`model/api.ts`, mutation на `POST /v1/tasks`) | Отдельная, самостоятельная фича — не знает про зарплатные правила вообще; используется и в общем разделе `/tasks` («создать задачу просто так»), и как шаг 1 мастера создания `TaskCompletion`-правила |
| `SalaryRuleForm` | existing, модифицируется | без изменений публичного API | `TaskCompletionRuleFields.tsx` (`ui/RuleFormCard/ui/`) — поле `taskId` теперь ОБЯЗАТЕЛЬНЫЙ readonly-параметр формы (передаётся мастером из шага 1, не вводится пользователем как текст) | Форма создания/редактирования правила для уже существующего `taskId`; шаблонные поля для авто-пересоздания на новый период (`taskTitleTemplate`/`taskDescriptionTemplate`/`deadlineTemplate`) остаются как отдельные, самостоятельные поля формы, не совпадающие с заголовком/описанием самой первой задачи |

### UI-компоненты (page-local и shared)

| Component | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные) | Назначение |
|---|---|---|---|
| `TaskList` | `pages/Tasks/ui/` | `tasks: Task[]`, `onSelect` | Список задач страницы `/tasks` |
| `TaskStatusBadge` | `shared/ui-kit/atoms/` (существующий, модифицируется) | `status: TaskStatusCode` (6 значений вместо захардкоженного `"DONE"`) | Единый визуальный индикатор статуса — переиспользуется в `TaskStatusControl`, `RuleSourcesRail`, `TaskList` |
| `TaskTransitionActions` | `features/TaskStatusControl/ui/` | `task: Task`, `actorRole: 'assignee' \| 'manager'` | Кнопки доступных переходов (зависят от текущего статуса и роли действующего пользователя) |

### Hooks (model)

| Hook | Расположение | Тип (state-хук / query options factory) | Возвращает |
|---|---|---|---|
| `tasksApi.list` | `pages/Tasks/model/api.ts` | query options factory | `queryOptions` для `GET /v1/tasks` |
| `tasksApi.get` | `features/TaskStatusControl/model/api.ts` | query options factory | `queryOptions` для `GET /v1/tasks/:id` |
| `tasksApi.transition` | `features/TaskStatusControl/model/api.ts` | mutation (query options factory для мутации) | `PATCH /v1/tasks/:id/status` |
| `tasksApi.create` | `features/CreateTask/model/api.ts` | mutation | `POST /v1/tasks` → `{ id: taskId }` |
| `useTasksPage` | `pages/Tasks/model/useTasksPage.ts` | state-хук (плоский объект) | `{ tasks, isInitialLoad, isRefreshing, statusFilter, setStatusFilter, ... }` |
| `useCreateTaskCompletionRuleWizard` | `pages/SalaryRuleDetail/mediator/model/` | mediator-хук (композиция `useCreateTask` + существующего `useSalaryRuleForm`) | `{ step, createdTaskId, goToRuleStep, ... }` — оркеструет переход между шагом создания задачи и шагом создания правила, без собственной бизнес-логики |

### Паттерны, которые нужно учесть при проектировании

- [x] Публичный API фичи только через `index.ts` (реэкспорт `TaskStatusControl`)
- [x] Запросы к backend — через `queryOptions({...})` в `model/api.ts`, не голыми async-функциями
- [x] Ошибки API — через `ApiError` в `.catch()` запроса
- [x] mediator/-компонент — требуется для `SalaryRuleDetail` при создании `TaskCompletion`-правила
      (2 stateful-виджета: форма задачи + форма правила), `Tasks` по-прежнему обходится без mediator
      (один виджет — список)
- [ ] Именованные слоты layout — не затрагивается этим change (не добавляем новый layout-контейнер)
- [x] `isInitialLoad`/`isRefreshing` — для списка `/tasks` (фильтр по статусу/направлению не должен
      "схлопывать" уже отрисованный список)
- [x] Новые компоненты — в `shared/ui-kit/`, `TaskStatusBadge` при доработке остаётся в `ui-kit`
      (уже там, см. предыдущий разбор `RuleSourcesRail.tsx`)

---

## Diagrams

### 1. Domain Entity Interaction
Miro link: https://miro.com/app/board/uXjVHpCIN2g=/?moveToWidget=3458764683077525119

### 2. External Modules Interaction
Miro link: https://miro.com/app/board/uXjVHpCIN2g=/?moveToWidget=3458764683077525118

### 3. Layer Interaction — от Controller до Response
Miro link: https://miro.com/app/board/uXjVHpCIN2g=/?moveToWidget=3458764683077525120

Доска целиком: https://miro.com/app/board/uXjVHpCIN2g=/

---

## Confirmation Checklist
- [ ] Названия entity/aggregate/VO согласованы
- [ ] Названия и сигнатуры ключевых методов сервисов согласованы
- [ ] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [ ] Диаграммы взаимодействия отражают ожидаемую реализацию
- [ ] Пользователь подтвердил переход к tasks.md
