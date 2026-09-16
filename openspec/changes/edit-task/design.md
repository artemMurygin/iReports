## Context

`Task` (`backend/src/modules/tasks/`) уже несёт `title`/`description`/`deadline`/`assigneeEmployeeId` и
геттеры для них (`domain/entities/task.entity.ts`), но не имеет мутатора для этих полей — только
`transitionTo`/`cancelForRuleDeletion` меняют статус. `TaskStatus` (value-object) уже имеет
`isTerminal()` (используется в `cancelForRuleDeletion`), которым переиспользуется проверка «нельзя
редактировать терминальную задачу» — новый VO-метод не нужен.

На фронтенде управление существующей задачей целиком живёт в `features/TaskStatusControl`
(`useTask`, `TaskStatusCard`, переходы статуса, комментарии, ссылки) — `features/CreateTask`
занимается только созданием. `features/*` не могут импортировать друг друга
(frontend/CLAUDE.md, `boundaries/dependencies`), а `TaskDetailsPanel`/`TaskStatusControl`
переиспользуется пятью с лишним страницами (`pages/Tasks`, `pages/SalaryReportV2`,
`pages/SalaryRuleDetail/{service,shop}`, `pages/SalaryRules`) — см. proposal.md, Impact.

## Goals / Non-Goals

**Goals:**
- `PATCH /v1/tasks/:id` частично обновляет `title`/`description`/`deadline`/`assigneeEmployeeId`.
- Обновление отклоняется, если задача уже в терминальном статусе.
- Редактирование доступно из карточки задачи (`TaskStatusCard`) на любой странице, где она уже
  открывается — без правки каждой из этих страниц по отдельности.

**Non-Goals:**
- RBAC/проверка, кто именно вправе редактировать задачу — как и переходы статуса (см.
  `ChangeTaskStatusCommand`'s WHY), это вне скоупа: любой аутентифицированный пользователь, которому
  доступна карточка задачи, может её отредактировать.
- Редактирование `direction` — это тег происхождения, проставляемый при создании
  (`specs/tasks/spec.md`, design.md `replace-bitrix-task-integration` решение 2), не поле, которое
  переназначают постфактум.
- История изменений/аудит правок полей — не входит в этот change.

## Decisions

**Decision 1 — `Task.update(...)` как обычный мутатор сущности, не через `transitionTo`.**
Новый метод `update(patch: Partial<{ title, description, deadline, assigneeEmployeeId }>)` на
`Task`: бросает `TaskAlreadyClosedException` (новое доменное исключение,
`domain/exceptions/task.exception.ts`, по прецеденту `InvalidTaskTransitionException`), если
`this.status.isTerminal()`, иначе применяет переданные поля (только те, что определены — партиал) и
вызывает `this.validate()` в конце (та же проверка непустого `title`/валидного `assigneeEmployeeId`,
что уже есть для создания). Не переиспользует `transitionTo` — это независимая ось изменения
(поля, не статус), не переход графа `TaskStatus`.

**Decision 2 — Партиал на всех трёх уровнях (contracts → command → entity), а не «все поля
обязательны».**
`updateTaskRequestSchema` — все четыре поля optional; `UpdateTaskCommand` несёт тот же optional-набор;
`Task.update` принимает `Partial<...>` и трогает только присланные поля. Причина: инлайн-редактирование
на фронте меняет как правило одно-два поля за раз (например, только дедлайн) — полный
re-submit всех четырёх полей на каждое малое изменение усложнил бы UI без необходимости. Альтернатива
(зеркалить `CreateTaskRequest` один-в-один, все поля обязательны) отклонена — заставила бы фронт всегда
слать текущее значение остальных полей, увеличивая риск гонки при параллельном редактировании двух
полей.

**Decision 3 — `PATCH routesV1.tasks.byId`, не новый маршрут.**
`byId: ${tasksRoot}/:id` уже существует и используется только `GET` (`get-task.http.controller.ts`).
Новый `UpdateTaskHttpController` регистрирует `@Patch(routesV1.tasks.byId)` на том же пути — Nest/
Express резолвят маршрут по методу+пути независимо (тот же приём, что уже задокументирован в
`app.routes.ts` про `:id/batch`), конфликта с `GET` нет. Не заводится отдельный `:id/details` или
подобный — `PATCH` на ресурсе для частичного обновления его же полей это и есть канонический REST-
паттерн, уже применённый для `PATCH .../status`, только на другом наборе полей.

**Decision 4 — Инлайн-редактирование внутри `features/TaskStatusControl`, а не отдельная фича
`features/EditTask`.**
Изначальный черновик proposal предполагал зеркалить `features/CreateTask` отдельной фичей
`features/EditTask`. Отклонено: карточка задачи (`TaskDetailsPanel`/`TaskStatusControl`) уже
переиспользуется пятью с лишним страницами (`pages/Tasks`, `pages/SalaryReportV2` (3 файла),
`pages/SalaryRuleDetail/{service,shop}`, `pages/SalaryRules`) — отдельная фича `EditTask` не может
быть импортирована `features/TaskStatusControl` (запрет кросс-импорта между `features/*`), поэтому
кнопку «Редактировать» и открытие панели редактирования пришлось бы добавлять в КАЖДУЮ из этих
страниц по отдельности, дублируя проводку `editingTaskId`/открытие панели. Вместо этого редактирование
— новая внутренняя способность уже существующей `TaskStatusControl` (тем же приёмом, что переходы
статуса/комментарии/ссылки уже живут внутри неё, а не как отдельные фичи) — работает на всех
потребителях `TaskDetailsPanel` сразу, без правки страниц. `useUpdateTask`/`useEditTaskForm` —
новые model-хуки в `features/TaskStatusControl/model/`, `EditTaskFields` — новый UI-компонент в
`features/TaskStatusControl/ui/`, использующие уже загруженный `task` (из `useTask`, уже вызванного в
`TaskStatusControl`) как начальные значения — повторный запрос задачи не нужен.

**Decision 5 — Кнопка-карандаш видна только для нетерминального статуса, режим редактирования —
локальный `useState` в `TaskStatusControl`.**
`TaskStatusCard` получает новый проп `isEditing`/`onToggleEdit`/`onSaveEdit` — при нетерминальном
статусе в заголовке рядом с `X` появляется кнопка-карандаш (`IconButton`, тот же паттерн, что кнопка
закрытия). Клик включает режим редактирования: секции «Описание» (`px-5 py-3.5`) и «Дедлайн» +
«Ответственный» (`flex gap-6 ...`) заменяются на `EditTaskFields` (поля формы на месте статичного
текста, по образцу `CreateTaskForm`'s полей, с теми же `shared/ui-kit` примитивами — `Input`/
`Textarea`/`Select`), а `title` в заголовке — на `Input`. Остальные секции карточки (переходы статуса,
зарплатное правило, ссылки, комментарии) не меняются и продолжают отображаться как есть под
формой — сохранение полей не требует выхода из этих других действий. `Отмена`/`Сохранить` в
`EditTaskFields` возвращает `isEditing` в `false`; терминальный статус (после того, как из карточки
случился переход в закрытый статус, пока панель открыта) сбрасывает `isEditing` принудительно —
`TaskStatusControl` не рендерит кнопку-карандаш вовсе, если `task.status` терминальный.

## Risks / Trade-offs

- [Партиал на фронте, но `Task.validate()` в конце проверяет РЕЗУЛЬТИРУЮЩЕЕ состояние сущности после
  merge] → безопасно: `TaskRepository.update` в хендлере читает текущую сущность из БД, применяет
  партиал через `Task.update(patch)` к уже загруженному объекту (не к сырому DTO), так что
  `validate()` видит финальные значения всех полей, а не только присланных — тот же приём, что
  `ChangeTaskStatusHandler` (читает `findById`, мутирует загруженную сущность, потом `update`).
- [Пять с лишним страниц полагаются на форму карточки задачи — регрессия в `TaskStatusCard` затронет
  их все разом] → `EditTaskFields`/режим редактирования — чисто аддитивное изменение вёрстки внутри
  уже существующих секций карточки (никакая другая секция не переставляется), плюс `isEditing`
  по умолчанию `false` — поведение для всех потребителей, ничего не сделавших специально, не меняется.

## Open Questions

(нет)
