## 1. `features/TaskStatusControl/model` — `tasksApi.remove` + `useDeleteTask`

- [x] 1.1 Написать тесты на `useDeleteTask`: успешный вызов делает `DELETE /v1/tasks/:id` (без тела) через `tasksApi.remove` и по `onSuccess` инвалидирует запросы с ключом `TASKS_QUERY_KEY_PREFIX`; ошибка API (в т.ч. 404) прокидывается наружу как `error`, не глотается молча — убедиться, что тест-раннер их видит
- [x] 1.2 Прогнать тесты из 1.1 и зафиксировать, что они падают (red) по ожидаемой причине — `tasksApi.remove`/`useDeleteTask` ещё не существуют
- [x] 1.3 Реализовать `tasksApi.remove(taskId)` в `frontend/src/features/TaskStatusControl/model/api.ts` (по образцу существующего `tasksApi.update`) и `useDeleteTask` в `frontend/src/features/TaskStatusControl/model/useDeleteTask.ts` (`useMutation`, `mutationFn: tasksApi.remove`, `onSuccess: invalidateQueries({ queryKey: TASKS_QUERY_KEY_PREFIX })`, по образцу `useUpdateTask.ts`)
- [x] 1.4 Прогнать тесты из 1.1 и зафиксировать, что они зелёные (green); прогнать остальной набор тестов `TaskStatusControl` и убедиться, что регрессий нет

## 2. `features/TaskStatusControl/model` — `useDeleteTaskDialog` (confirm-хук)

- [x] 2.1 Написать тесты на `useDeleteTaskDialog`: `open()`/`close()` переключают `isOpen`; `confirm()` вызывает переданное async-действие, во время выполнения `isPending === true`; при успехе диалог закрывается (`isOpen === false`) и `error === null`; при ошибке диалог остаётся открытым, `error` заполнен, `isPending` возвращается в `false` — убедиться, что тест-раннер их видит
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать, что они падают (red) по ожидаемой причине — `useDeleteTaskDialog` ещё не существует
- [x] 2.3 Реализовать `useDeleteTaskDialog` в `frontend/src/features/TaskStatusControl/model/useDeleteTaskDialog.ts` — плоский объект `{ isOpen, open, close, confirm, isPending, error }`, по образцу `useDeleteRuleTask` (`frontend/src/features/SalaryRuleForm/model/useDeleteRuleTask.ts`); `confirm` принимает `useDeleteTask`'ный `mutateAsync` как раннер
- [x] 2.4 Прогнать тесты из 2.1 и зафиксировать, что они зелёные (green), регрессий в соседних тестах нет

## 3. `features/TaskStatusControl/ui` — `DeleteTaskDialog`

- [x] 3.1 Написать тесты (RTL) на `DeleteTaskDialog`: рендерит заголовок задачи и предупреждение о безвозвратности; клик «Удалить» вызывает `onConfirm`; клик «Отмена» и закрытие диалога вызывают `onCancel`; при `isPending` кнопка подтверждения показывает `Loader2` и недоступна повторному клику, закрытие диалога заблокировано; при непустом `error` показывается блок ошибки с текстом сообщения и иконкой `RotateCw` на кнопке подтверждения — убедиться, что тест-раннер их видит
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать, что они падают (red) по ожидаемой причине — компонент ещё не существует
- [x] 3.3 Реализовать `DeleteTaskDialog` в `frontend/src/features/TaskStatusControl/ui/DeleteTaskDialog.tsx` на `shared/ui-kit/organisms/Modal`, по образцу `DeleteRuleTaskDialog.tsx`/`DeleteMotivationSchemaDialog.tsx` (см. ui-design.md, раздел «Ключевые состояния экранов» — отдельного .pen-макета нет, макет по решению пользователя не создавался, компонент собирается из существующих `Modal`/`Button`/`IconButton` UI Kit)
- [x] 3.4 Прогнать тесты из 3.1 и зафиксировать, что они зелёные (green), регрессий в соседних тестах нет

## 4. `features/TaskStatusControl/ui` — интеграция в `TaskStatusCard`/`TaskDetailsPanel`

- [x] 4.1 Написать тесты на интеграцию: клик по кнопке «Удалить» (`Trash2`) в заголовке `TaskStatusCard` открывает `DeleteTaskDialog`; кнопка видна и активна независимо от статуса задачи, включая терминальные («Закрыта успешно», «Закрыто неуспешно») — в отличие от кнопки «Редактировать»; успешное подтверждение удаления закрывает `TaskDetailsPanel` (`onClose` вызван ровно один раз) — убедиться, что тест-раннер их видит
- [x] 4.2 Прогнать тесты из 4.1 и зафиксировать, что они падают (red) по ожидаемой причине — кнопка и wiring ещё не реализованы
- [x] 4.3 Реализовать: добавить `IconButton` «Удалить» (`Trash2`, `variant="danger"`) в заголовок `frontend/src/features/TaskStatusControl/ui/TaskStatusCard.tsx` рядом с существующими «Редактировать»/«Закрыть», без ограничения по статусу задачи; подключить `useDeleteTask` + `useDeleteTaskDialog` + `DeleteTaskDialog`; на успешном удалении вызвать `onClose` панели (`frontend/src/features/TaskStatusControl/ui/TaskDetailsPanel.tsx`)
- [x] 4.4 Прогнать тесты из 4.1 и зафиксировать, что они зелёные (green); прогнать весь тестовый набор `features/TaskStatusControl` и убедиться, что регрессий нет

## 5. Документация и проверка в браузере

- [x] 5.1 Обновить `ENDPOINTS.md` (описание `DELETE /v1/tasks/:id`) — отметить, что эндпоинт теперь используется напрямую из UI карточки задачи, не только из потока удаления задачи зарплатного правила
- [ ] 5.2 Запустить фронтенд (`docker compose` или `start:dev`) и вручную проверить сценарий: открыть карточку произвольной задачи (в т.ч. в терминальном статусе) → нажать «Удалить» → подтвердить → карточка закрывается, задача пропадает из списка `pages/Tasks`; повторить с отменой в диалоге — задача остаётся без изменений; зафиксировать результат
