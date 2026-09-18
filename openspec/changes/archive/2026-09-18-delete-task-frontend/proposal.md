## Why

Бэкенд уже поддерживает безвозвратное удаление задачи (`DELETE /v1/tasks/:id`, `backend/src/modules/tasks/interface/http-controllers/delete-task.http.controller.ts`), но на фронтенде эта возможность доступна только косвенно — как побочный эффект удаления «задачи для зарплатного правила» внутри `features/SalaryRuleForm`. У пользователя нет прямого способа удалить произвольную задачу из карточки задачи (`TaskDetailsPanel`/`TaskStatusCard`), хотя ошибочно созданные или более неактуальные задачи должны быть удаляемы без обращения к разработчикам.

## What Changes

- Добавить кнопку «Удалить» (иконка `Trash2`) в заголовок карточки задачи `TaskStatusCard` рядом с существующими кнопками «Редактировать» и «Закрыть карточку».
- Добавить confirm-диалог удаления задачи (`Modal` + двухчастный паттерн хук/диалог, по образцу `DeleteRuleTaskDialog`/`useDeleteRuleTask`), показывающий заголовок задачи и предупреждающий о безвозвратности действия.
- Добавить `tasksApi.remove` и мутацию `useDeleteTask` в `features/TaskStatusControl/model/`, вызывающие уже существующий `DELETE /v1/tasks/:id`.
- После успешного удаления: закрыть `TaskDetailsPanel` и инвалидировать/удалить закешированные запросы задач (`TASKS_QUERY_KEY_PREFIX`), чтобы список задач на странице `pages/Tasks` обновился без ручного удаления задачи.
- Кнопка удаления доступна независимо от статуса задачи (в т.ч. для задач в терминальном статусе) — в отличие от редактирования, которое в терминальном статусе скрыто.

## Capabilities

### New Capabilities
_нет_

### Modified Capabilities
- `tasks`: добавляется новое требование — пользователь может удалить задачу через UI карточки задачи; удаление безвозвратно и закрывает панель деталей.

## Impact

- **Frontend**: `frontend/src/features/TaskStatusControl/model/api.ts` (новый метод `remove`), новый `frontend/src/features/TaskStatusControl/model/useDeleteTask.ts`, новый `frontend/src/features/TaskStatusControl/model/useDeleteTaskDialog.ts` (confirm-хук), новый `frontend/src/features/TaskStatusControl/ui/DeleteTaskDialog.tsx`, изменения в `frontend/src/features/TaskStatusControl/ui/TaskStatusCard.tsx` (кнопка) и `frontend/src/features/TaskStatusControl/ui/TaskDetailsPanel.tsx` (закрытие панели после удаления).
- **Backend**: без изменений — `DELETE /v1/tasks/:id` уже реализован и задокументирован в `ENDPOINTS.md:121-125`.
- **Contracts**: без изменений — у DELETE нет тела запроса/ответа, отдельная zod-схема не нужна (как и у существующего `DELETE /v1/tasks/:id/links/:linkId`).
- **Spec**: новый Requirement «Удаление задачи через интерфейс» в `openspec/specs/tasks/spec.md` (сейчас в главном спеке такого требования нет вовсе, хотя backend-эндпоинт существует).
