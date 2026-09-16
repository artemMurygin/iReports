## 1. Backend — доменный слой: `Task.update`

- [ ] 1.1 В `backend/src/modules/tasks/domain/entities/task.entity.spec.ts` написать тесты: `update()` применяет частичный патч (`title`/`description`/`deadline`/`assigneeEmployeeId`) к нетерминальной задаче; `update()` бросает новое `TaskAlreadyClosedException`, не меняя поля, если `status` — `CLOSED_SUCCESSFULLY` или `CLOSED_UNSUCCESSFULLY`; `update({ title: '' })` бросает `ArgumentInvalidException` (через `validate()`, как и при создании). Убедиться, что jest видит новые тесты (`npm run test -- task.entity`).
- [ ] 1.2 Прогнать тесты из 1.1 и зафиксировать, что они падают (red) — метода `update` ещё нет.
- [ ] 1.3 Реализовать `Task.update(patch)` в `task.entity.ts` (design.md Decision 1) и `TaskAlreadyClosedException` в `domain/exceptions/task.exception.ts` (по прецеденту `InvalidTaskTransitionException`).
- [ ] 1.4 Прогнать тесты из 1.1 — зелёные (green); прогнать весь `task.entity.spec.ts` и `task-status.value-object.spec.ts` — без регрессий.

## 2. Backend — application: `UpdateTaskCommand`/`UpdateTaskHandler`

- [ ] 2.1 Создать `application/command/update-task/update-task.handler.spec.ts` (по прецеденту `change-task-status.handler.spec.ts`): успешный вызов читает задачу через `TASK_REPOSITORY.findById`, вызывает `task.update(...)` и `taskRepo.update(task)`; `TaskNotFoundException`, если `findById` вернул `null`; `TaskAlreadyClosedException` из `task.update` пробрасывается БЕЗ вызова `taskRepo.update` (ничего не персистится, тот же принцип, что у недопустимого перехода статуса).
- [ ] 2.2 Прогнать тесты из 2.1 — red (хендлера ещё нет).
- [ ] 2.3 Реализовать `UpdateTaskCommand` (`application/command/update-task/update-task.command.ts`: `taskId` + опциональные `title`/`description`/`deadline`/`assigneeEmployeeId`) и `UpdateTaskHandler` (`update-task.handler.ts`, `@CommandHandler`); зарегистрировать хендлер в `tasks.module.ts` рядом с `ChangeTaskStatusHandler`.
- [ ] 2.4 Прогнать тесты из 2.1 — green; прогнать весь `npm run test -- modules/tasks/application` — без регрессий.

## 3. Contracts — `updateTaskRequestSchema`

- [ ] 3.1 В `contracts/commands/task.ts` добавить `updateTaskRequestSchema` (все поля `title`/`description`/`deadline`/`assigneeEmployeeId` — `.optional()`, `title` при наличии — `.min(1)`, `deadline` — `isoDateStringSchema.optional()`, тем же приёмом, что `createTaskRequestSchema`) и экспортировать тип `UpdateTaskRequest`; добавить обе в barrel-экспорт `export { ... }` внизу файла. Тестов не заводится — это литеральная zod-схема без ветвлений/собственной логики (обоснование исключения из TDD, инструкция tasks.md). Проверка — `npm run build` в `contracts/` проходит без ошибок типов.

## 4. Backend — interface: `PATCH /v1/tasks/:id`

- [ ] 4.1 В `backend/src/modules/tasks/interface/http-controllers/tasks.e2e.spec.ts` написать e2e-тесты: `PATCH /v1/tasks/:id` с частичным телом (например, только `{ deadline }`) возвращает `200` и обновлённую задачу, не трогая остальные поля; `PATCH` на несуществующий `id` → `404`; `PATCH` на задачу в статусе `CLOSED_SUCCESSFULLY`/`CLOSED_UNSUCCESSFULLY` (предварительно перевести через существующие переходы) → `400` (маппинг `TaskAlreadyClosedException` через `DomainExceptionFilter`, тот же код, что `InvalidTaskTransitionException`).
- [ ] 4.2 Прогнать тесты из 4.1 — red (эндпоинта ещё нет).
- [ ] 4.3 Реализовать `UpdateTaskDto` (`interface/dto/update-task.dto.ts`, `createZodDto(updateTaskRequestSchema)`) и `UpdateTaskHttpController` (`interface/http-controllers/update-task.http.controller.ts`): `@Patch(routesV1.tasks.byId)`, `@ApiTags('Задачи')`, `@ApiOperation({ summary: 'Изменить поля существующей задачи (заголовок/описание/дедлайн/ответственный)' })`, тело — `UpdateTaskDto`, возврат — `Promise<Task>` через `GetTaskService` (тот же приём, что `ChangeTaskStatusHttpController`). Зарегистрировать контроллер в `tasks.module.ts`.
- [ ] 4.4 Прогнать тесты из 4.1 — green; прогнать весь `npm run test:e2e -- tasks` — без регрессий (в т.ч. `task-comments-links.e2e.spec.ts`).
- [ ] 4.5 Добавить запись `PATCH /v1/tasks/:id` в раздел `## modules/tasks (\`/v1/tasks\`)` файла `ENDPOINTS.md` (по образцу уже существующей записи `PATCH /v1/tasks/:id/status`), с кратким описанием и ссылкой на `openspec/changes/edit-task`.

## 5. Frontend — модель: `tasksApi.update` + `useUpdateTask`

- [ ] 5.1 В `frontend/src/features/TaskStatusControl/model/api.spec.ts` добавить тест `describe('tasksApi.update')`: вызывает `apiInstance.patch` с `/v1/tasks/:id` и переданным частичным payload'ом (по прецеденту тестов `commentsApi.create`/`linksApi.create` в этом же файле). В новом `model/useUpdateTask.spec.tsx` (по прецеденту `CreateTask/model/useCreateTask.spec.tsx`) — тест, что успешная мутация инвалидирует `TASKS_QUERY_KEY_PREFIX`.
- [ ] 5.2 Прогнать тесты из 5.1 — red.
- [ ] 5.3 Реализовать `tasksApi.update(taskId, payload: UpdateTaskRequest): Promise<Task>` в `model/api.ts` (обычная async-функция, как `tasksApi.transition` — ошибка НЕ оборачивается в `ApiError`, `TaskAlreadyClosedException` должна остаться читаемой через `extractApiErrorMessage` в UI) и `useUpdateTask(taskId)` в новом `model/useUpdateTask.ts` (по прецеденту `useTaskTransition.ts`: `useMutation` + `invalidateQueries({ queryKey: TASKS_QUERY_KEY_PREFIX })` на успехе).
- [ ] 5.4 Прогнать тесты из 5.1 — green; прогнать `npm run test -- TaskStatusControl` — без регрессий.

## 6. Frontend — модель: `useEditTaskForm`

- [ ] 6.1 В новом `model/useEditTaskForm.spec.ts` (по прецеденту `CreateTask/model/useCreateTaskForm.spec.ts`) написать тесты: черновик (`draft`) инициализируется из переданного `task` при входе в режим редактирования; `patch(partial)` меняет только указанные поля черновика; `canSave` — `false`, когда `title` пуст или `deadline` пуст или `assigneeEmployeeId === null`; `save()` вызывает `useUpdateTask`'s `mutate` с текущим черновиком (`title`/`description`/`deadline`/`assigneeEmployeeId`) и на успехе вызывает переданный `onSaved()`.
- [ ] 6.2 Прогнать тесты из 6.1 — red.
- [ ] 6.3 Реализовать `useEditTaskForm(task: Task, onSaved?: () => void)` в `model/useEditTaskForm.ts` — плоский объект состояния (frontend/CLAUDE.md, "model-хуки с плоским объектом"), композирующий `useUpdateTask(task.id)` (design.md Decision 5: draft уже несёт текущие значения всех полей, поэтому `save()` отправляет их все — партиальность контракта (change 3) используется другими вызывающими, а не обязательна здесь).
- [ ] 6.4 Прогнать тесты из 6.1 — green.

## 7. Frontend — UI: `EditTaskFields`

- [ ] 7.1 В новом `ui/EditTaskFields.spec.tsx` написать тесты (по прецеденту `TaskLinksSection.spec.tsx`): поля «Заголовок»/«Описание»/«Дедлайн»/«Ответственный» рендерятся со значениями `draft`; ввод в поле вызывает `onPatch` с соответствующим ключом; клик «Сохранить» вызывает `onSave` и задизейблен, когда `canSave === false` или `isPending === true`; клик «Отмена» вызывает `onCancel`; при наличии `error` отображается текст ошибки (`role="alert"`).
- [ ] 7.2 Прогнать тесты из 7.1 — red (компонента ещё нет).
- [ ] 7.3 Реализовать `EditTaskFields` в `ui/EditTaskFields.tsx` — визуально копирует `CreateTaskForm`'s поля (`Input`/`Textarea`/`Select` из `shared/ui-kit/atoms`, тот же `label`/`gap`-стиль), см. ui-design.md; список сотрудников — свой `useQuery(tasksApi.getAssigneeEmployees())` (уже существует в `model/api.ts`, переиспользуется, не дублируется).
- [ ] 7.4 Прогнать тесты из 7.1 — green.

## 8. Frontend — интеграция: кнопка-карандаш и режим редактирования в `TaskStatusCard`/`TaskStatusControl`

- [ ] 8.1 В `ui/TaskStatusControl.spec.tsx` (существующий файл) добавить тесты: кнопка-карандаш в заголовке карточки НЕ рендерится, когда `task.status` — `CLOSED_SUCCESSFULLY`/`CLOSED_UNSUCCESSFULLY`; клик по кнопке-карандашу (для нетерминального статуса) переключает карточку в режим редактирования — секции «Описание»/«Дедлайн»/«Ответственный» заменяются на `EditTaskFields` с текущими значениями задачи; успешное сохранение возвращает карточку в режим просмотра.
- [ ] 8.2 Прогнать тесты из 8.1 — red.
- [ ] 8.3 Реализовать: `TaskStatusCard` получает пропы `isEditing`/`onToggleEdit`/`editFieldsProps` (design.md Decision 5) — кнопка-карандаш (`IconButton`, рядом с `X`) рендерится только при `!terminalNote`; при `isEditing` секции «Описание» и «Дедлайн»/«Ответственный» заменяются на `<EditTaskFields {...editFieldsProps} />`, заголовок (`h2`) заменяется на `Input`. `TaskStatusControl` заводит `const [isEditing, setIsEditing] = useState(false)`, вызывает `useEditTaskForm(task, () => setIsEditing(false))` только когда `task` загружена, и пробрасывает всё в `TaskStatusCard`.
- [ ] 8.4 Прогнать тесты из 8.1 — green; прогнать весь `npm run test -- TaskStatusControl` — без регрессий (включая `TaskDetailsPanel.spec.tsx`).

## 9. Проверка в браузере и документация

- [ ] 9.1 Запустить `docker compose up` (или `npm run start:dev`/`npm run start` в `backend`/`frontend`), открыть `/tasks`, создать тестовую задачу, открыть её карточку, нажать карандаш, изменить заголовок/описание/дедлайн/ответственного, сохранить — убедиться, что изменения отражаются в карточке и в списке `/tasks` без перезагрузки страницы.
- [ ] 9.2 Перевести ту же задачу в `CLOSED_SUCCESSFULLY` (или `CLOSED_UNSUCCESSFULLY`) и убедиться, что кнопка-карандаш пропала из карточки.
- [ ] 9.3 Открыть карточку задачи, связанной с правилом `TaskCompletion`, из `pages/SalaryRuleDetail`/`pages/SalaryRules`/`pages/SalaryReportV2` — убедиться, что редактирование доступно и там (design.md Decision 4 — без правки этих страниц).
