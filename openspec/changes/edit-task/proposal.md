## Why

Сейчас задачу в iReports можно только создать и сменить её статус — заголовок, описание, дедлайн и ответственного изменить нельзя ни через API, ни через UI. Если создатель ошибся в данных или обстоятельства изменились (перенесли дедлайн, переназначили ответственного), единственный обходной путь — отменить задачу и создать новую, теряя историю комментариев и ссылок. Нужна возможность редактировать поля существующей задачи.

## What Changes

- Новый эндпоинт `PATCH /v1/tasks/:id` для частичного обновления полей задачи (`title`, `description`, `deadline`, `assigneeEmployeeId`).
- Метод `Task.update(...)` в доменной сущности `Task` (`backend/src/modules/tasks/domain/entities/task.entity.ts`), применяющий и валидирующий изменения полей.
- Схема `updateTaskRequestSchema` в `contracts/commands/task.ts` (все поля опциональны, частичное обновление).
- Редактирование доступно только для задач, ещё не находящихся в терминальном статусе («Закрыта успешно» или «Закрыто неуспешно») — завершённая задача — исторический факт и не редактируется.
- Фронтенд: инлайн-редактирование прямо внутри уже существующей фичи `features/TaskStatusControl` (кнопка-карандаш в заголовке карточки задачи переключает секции «Описание»/«Дедлайн»/«Ответственный» в режим формы) — не отдельная фича, см. design.md за обоснованием (запрет кросс-импорта между `features/*`, FSD).

## Capabilities

### New Capabilities

(нет — расширяется существующая capability)

### Modified Capabilities

- `tasks`: добавляется требование о редактировании полей существующей задачи (title/description/deadline/assignee) через `PATCH /v1/tasks/:id`, с ограничением — недоступно для задач в финальном успешном статусе.

## Impact

- **Backend**: `backend/src/modules/tasks/domain/entities/task.entity.ts`, `application/commands/` (новый `UpdateTaskCommand`/handler), `interface/http-controllers/` (новый `update-task.http.controller.ts`), `interface/dto/` (новый `update-task.dto.ts`), `config/app.routes.ts` (маршрут уже есть как `byId`, используется для PATCH).
- **Contracts**: `contracts/commands/task.ts` — новая схема `updateTaskRequestSchema`.
- **Frontend**: `frontend/src/features/TaskStatusControl/` — новые `model/useUpdateTask.ts`, `model/useEditTaskForm.ts`, `ui/EditTaskFields.tsx`; изменения `model/api.ts` (метод `update`), `ui/TaskStatusControl.tsx` (состояние режима редактирования), `ui/TaskStatusCard.tsx` (кнопка-карандаш в заголовке, условный рендер `EditTaskFields` вместо статичных секций).
- **Spec**: `openspec/specs/tasks/spec.md` — дельта с новым требованием редактирования.
