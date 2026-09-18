# Architecture: edit-task

## Scope

Затрагивает только сквозной модуль `backend/src/modules/tasks/` (новый мутатор сущности `Task`,
command/handler, HTTP-контроллер, DTO) и фронтенд-фичу `frontend/src/features/TaskStatusControl/`
(новые model-хуки и UI-компонент внутри неё) — ни новых доменных модулей, ни новых страниц не
заводится.

---

## Backend — Domain Model

### Entities

| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `Task` | existing | да | `title`, `description`, `deadline`, `assigneeEmployeeId`, `status` | Получает новый метод `update(patch)` — партиальное изменение title/description/deadline/assigneeEmployeeId, отклоняется при терминальном статусе |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `Task` | `Task` | `TaskStatus` (VO) | Поля задачи не меняются, пока `TaskStatus.isTerminal()` — терминальная задача исторически неизменна (design.md Decision 1) |

### Value Objects

Новых VO не заводится — `update` переиспользует существующий `TaskStatus.isTerminal()`
(`domain/value-objects/task-status.value-object.ts`), тем же приёмом, что и `cancelForRuleDeletion`.

### Services

| Service | Слой (application/domain/infrastructure) | Ответственность |
|---|---|---|
| `UpdateTaskHandler` | application (CQRS command handler) | Загружает `Task` по id, вызывает `task.update(patch)`, персистит через `TaskRepositoryPort.update` |
| `GetTaskService` | application (existing) | Переиспользуется контроллером для возврата актуального `Task` после обновления — тот же приём, что `ChangeTaskStatusHttpController` |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `Task.update` | `patch: Partial<{ title: string; description: string \| null; deadline: Date; assigneeEmployeeId: number }>` | `void` | Бросает `TaskAlreadyClosedException`, если `status.isTerminal()`; иначе применяет присланные поля и вызывает `validate()` |
| `UpdateTaskHandler.execute` | `UpdateTaskCommand { taskId: string; title?: string; description?: string; deadline?: Date; assigneeEmployeeId?: number }` | `Promise<void>` | `findById` → `TaskNotFoundException`, если не найдена → `task.update(...)` → `taskRepo.update(task)` |
| `UpdateTaskHttpController.update` | `id: string` (param), `UpdateTaskDto` (body) | `Promise<Task>` | `PATCH routesV1.tasks.byId` → `commandBus.execute(new UpdateTaskCommand(...))` → `getTask.execute(id)` |

---

## Frontend — UI Model

### Pages

Новых/изменённых страниц нет — все существующие потребители `TaskDetailsPanel`/`TaskStatusControl`
(`pages/Tasks`, `pages/SalaryReportV2`, `pages/SalaryRuleDetail/{service,shop}`, `pages/SalaryRules`)
получают редактирование автоматически, без правок (design.md Decision 4).

### Features (переиспользуемые модули с бизнес-логикой)

| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `TaskStatusControl` | existing, расширяется | без изменений (`TaskStatusControl`, `TaskDetailsPanel`) | `+useUpdateTask.ts`, `+useEditTaskForm.ts`, `api.ts` получает метод `tasksApi.update` | Добавляет инлайн-редактирование title/description/deadline/assigneeEmployeeId прямо в карточку задачи |

### UI-компоненты (page-local и shared)

| Component | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные) | Назначение |
|---|---|---|---|
| `EditTaskFields` | `features/TaskStatusControl/ui` (new) | `draft`, `onPatch`, `employees`, `onSave`, `onCancel`, `isPending`, `error` | Поля формы (заголовок/описание/дедлайн/ответственный) на месте статичных секций `TaskStatusCard`, пока активен режим редактирования |
| `TaskStatusCard` | `features/TaskStatusControl/ui` (existing, изменяется) | `+isEditing`, `+onToggleEdit`, `+editProps` (пробрасывается в `EditTaskFields`) | Заголовок получает кнопку-карандаш (видна только для нетерминального статуса); секции «Описание»/«Дедлайн»/«Ответственный» условно заменяются на `EditTaskFields` |

### Hooks (model)

| Hook | Расположение | Тип (state-хук / query options factory) | Возвращает |
|---|---|---|---|
| `tasksApi.update` | `features/TaskStatusControl/model/api.ts` (existing файл, новый метод) | plain async-функция (мутация, не `queryOptions`) — тот же приём, что `tasksApi.transition` | `Promise<Task>` |
| `useUpdateTask` | `features/TaskStatusControl/model/useUpdateTask.ts` (new) | mutation-хук (`useMutation` + инвалидация `TASKS_QUERY_KEY_PREFIX`) | `{ mutate, isPending, isError, error }` — тот же приём, что `useTaskTransition` |
| `useEditTaskForm` | `features/TaskStatusControl/model/useEditTaskForm.ts` (new) | state-хук с плоским объектом (frontend/CLAUDE.md, "model-хуки с плоским объектом") | `{ draft, patch, canSave, save, cancel, isPending, error }` — инициализируется из переданного `task` при входе в режим редактирования |

### Паттерны, которые нужно учесть при проектировании

- [x] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента) — `EditTaskFields`/`useEditTaskForm`/`useUpdateTask` НЕ реэкспортируются наружу, используются только внутри `TaskStatusControl`
- [x] Запросы к backend — через query options factory в `model/api.ts` — не применимо к `update` (мутация, не чтение), тот же приём, что уже принят для `tasksApi.transition`/`commentsApi.create`/`linksApi.create` в этом же файле
- [x] Ошибки API нормализуются через `ApiError` — `update` не оборачивает ошибку в `ApiError` (тот же приём, что `transition`: `TaskAlreadyClosedException`/`ArgumentInvalidException` отдают читаемый `message`, разворачиваемый `extractApiErrorMessage` в UI-обработчике)
- [ ] mediator-компонент — не применимо, `TaskStatusControl` уже не заводит новый stateful-виджет, только расширяет существующий
- [ ] именованные слоты вместо `children` — не применимо, `EditTaskFields` не контейнер
- [ ] `isInitialLoad`/`isRefreshing` — не применимо, нет списочных данных с фильтрами
- [x] Новые компоненты — в `features/TaskStatusControl/ui/` (уже мигрированная фича на `shared/ui-kit`), `EditTaskFields` использует те же `Input`/`Textarea`/`Select` из `shared/ui-kit/atoms`, что и `CreateTaskForm`

---

## Diagrams

Для этого change диаграммы на Miro-доске не заводились — только один существующий агрегат (`Task`),
один новый application-хендлер и один модифицируемый frontend-компонент; поток запроса зеркалит уже
задокументированный `PATCH .../status` (`ChangeTaskStatusHttpController` → `ChangeTaskStatusHandler`
→ `Task.transitionTo` → `TaskRepository.update`), только с `update`/`Task.update` вместо
`transition`/`Task.transitionTo`. Решение подтверждено пользователем — см. Confirmation Checklist.

### 1. Domain Entity Interaction
Не создавалась (см. выше).

### 2. External Modules Interaction
Не создавалась — изменение не затрагивает `service`/`shop`/внешние системы: `Task` остаётся
самостоятельной сущностью (specs/tasks/spec.md), `accounting` по-прежнему обращается к ней только
через `TASK_REPOSITORY.findManyByIds`, который не меняется.

### 3. Layer Interaction — от Controller до Response
Не создавалась — путь идентичен уже существующему `PATCH .../status`
(`interface/http-controllers/change-task-status.http.controller.ts`), см. текстовое описание выше.

---

## Confirmation Checklist

- [x] Названия entity/aggregate/VO согласованы — новых нет, `Task`/`TaskStatus` переиспользуются как есть
- [x] Названия и сигнатуры ключевых методов сервисов согласованы — `Task.update`, `UpdateTaskHandler.execute`, `UpdateTaskHttpController.update`
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы — расширение `features/TaskStatusControl`, без новой фичи/страницы (design.md Decision 4)
- [x] Диаграммы взаимодействия отражают ожидаемую реализацию — намеренно не создавались на Miro (тривиальное зеркало уже задокументированного потока `PATCH .../status`), см. раздел Diagrams
- [x] Пользователь подтвердил переход к tasks.md — подтверждено 2026-09-15
