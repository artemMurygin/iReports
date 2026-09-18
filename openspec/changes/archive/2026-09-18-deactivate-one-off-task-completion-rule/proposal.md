## Why

Сейчас разовое (`isRecurring: false`) зарплатное правило «за выполнение задачи» после отработки своего единственного периода остаётся активным бессрочно — деактивировать его руководитель может только вручную. Это создаёт риск задвоенного/устаревшего правила в схеме мотивации: правило продолжает числиться активным, хотя задача уже закрыта неуспешно (повторного начисления по ней не будет) либо начисление по ней уже зафиксировано (цель правила достигнута).

## What Changes

- Разовое правило «за выполнение задачи» автоматически деактивируется (`isActive: false`), когда связанная с ним задача закрывается со статусом `CLOSED_UNSUCCESSFULLY`.
- Разовое правило «за выполнение задачи» автоматически деактивируется, когда руководитель фиксирует фактическую сумму начисления по строке этого правила (`SetTaskCompletionLineReward`).
- Регулярные (`isRecurring: true`) правила это поведение не затрагивает — они продолжают получать новые задачи на новые периоды независимо от статуса задачи текущего периода.
- Модуль `tasks` публикует доменное событие о переходе задачи в терминальный статус; модуль `accounting` (`service` и `shop`) подписывается на него и деактивирует своё разовое правило, если оно ссылается на эту задачу. Для сценария фиксации начисления событие не требуется — деактивация выполняется тем же handler'ом, который сохраняет сумму, без пересечения модульных границ.
- Сущность `Task` переводится с `Entity` на `AggregateRoot`, чтобы иметь возможность публиковать доменные события при переходе статуса.

## Capabilities

### New Capabilities

(нет)

### Modified Capabilities

- `tasks`: задача, переходящая в терминальный статус, публикует доменное событие с данными, достаточными для внешнего модуля-подписчика (id задачи, целевой статус).
- `service/accounting`: разовое правило «за выполнение задачи» автоматически деактивируется при неуспешном закрытии связанной задачи или при фиксации фактического начисления по нему; регулярные правила это поведение не затрагивает.
- `shop/accounting`: то же требование, зеркально для домена `shop`.

## Impact

- `backend/src/modules/tasks/domain/entities/task.entity.ts` — переход на `AggregateRoot`, публикация события в `transitionTo()`.
- `backend/src/modules/tasks/application/command/change-task-status/change-task-status.handler.ts` — без изменений в бизнес-логике, но должен участвовать в той же транзакционной обвязке (`DatabaseService.withTransaction`), что и `publishEvents()`.
- `backend/src/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity.ts` и `backend/src/domains/shop/modules/accounting/domain/entities/salary-rules/task-completion.entity.ts` — используется уже существующий `deactivate()`.
- `backend/src/domains/service/modules/accounting/application/command/salary-accrual/set-task-completion-line-reward.handler.ts` и зеркальный обработчик в `shop` — добавляется деактивация правила после сохранения суммы.
- Новый event-handler в `backend/src/domains/service/modules/accounting` и `backend/src/domains/shop/modules/accounting`, подписанный на событие из `tasks` (`@OnEvent`), находящий разовое правило по `taskId` в `config.taskIdByPeriod`.
