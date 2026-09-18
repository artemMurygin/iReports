## Context

См. proposal.md — Why/What Changes для мотивации и общего описания.

Два независимых триггера деактивации разового правила `TaskCompletion`:

- **Неуспешное закрытие задачи** — межмодульная граница `tasks → accounting`. `Task`
  (`backend/src/modules/tasks/domain/entities/task.entity.ts`) сейчас наследует `Entity`, не
  `AggregateRoot`, и не публикует событий. `TaskRepository.update()` уже вызывает `this.write(task, …)`
  из `PrismaRepository` (`backend/src/shared/infrastructure/persistence/prisma.repository.ts`), которая
  сама оборачивает запись в `DatabaseService.withTransaction` и, **если сущность —
  `instanceof AggregateRoot`**, ставит её в очередь на `publishEvents()` после коммита. То есть
  инфраструктура публикации событий уже полностью на месте — перевод `Task` на `AggregateRoot`
  достаточен сам по себе, без изменений в `ChangeTaskStatusHandler` или в репозитории.
- **Фиксация фактического начисления** — целиком внутри `accounting`
  (`SetTaskCompletionLineRewardHandler`), правило уже известно по `ruleId` из команды — событие не
  требуется.

Существующий прецедент того же рода связи (правило → задача) —
`CancelTaskForRuleDeletionService`/`Task.cancelForRuleDeletion()` (описан в предыдущем исследовании
этого треда). Обратное направление (задача → правило) в коде и в `openspec/specs/tasks/spec.md`
сейчас не специфицировано.

`SalaryRuleRepositoryPort.findByTaskId` (`service`) и его аналог в `shop` уже существуют
(`add-task-salary-rule-links-comments`), но ищут совпадение только в `config.taskIdByPeriod[Period.current()]`
— для панели связей задачи, где интересен только текущий период. Для нашего сценария это недостаточно:
разовое правило могло быть создано в прошлом расчётном периоде, и его единственная задача может
закрыться неуспешно уже после того, как текущий период сместился — поиск по одному лишь текущему
периоду её не найдёт.

## Goals / Non-Goals

**Goals:**
- Деактивировать разовое (`isRecurring: false`) правило `TaskCompletion` при неуспешном закрытии
  связанной задачи, вне зависимости от того, в каком периоде правило было создано.
- Деактивировать разовое правило `TaskCompletion` при фиксации фактической суммы начисления по нему.
- Дать `tasks` способ уведомлять внешние модули о терминальном статусе задачи, не зная о зарплатных
  правилах (принцип из `backend/CLAUDE.md`: `Task` "полностью самостоятельная и не знающая о
  зарплатных правилах").

**Non-Goals:**
- Регулярные (`isRecurring: true`) правила — их деактивация этим изменением не триггерится ни при
  каком статусе задачи.
- Успешное закрытие задачи (`CLOSED_SUCCESSFULLY`) само по себе деактивацию не запускает — только
  последующая фиксация начисления (`SetTaskCompletionLineReward`).
- Реакция на `cancelForRuleDeletion()` (задача отменяется самим `accounting` при удалении/PATCH-
  удалении правила) — событие из этого перехода не нужно и не публикуется: правило-инициатор уже
  само себя изменяет в той же операции, реакция на собственное действие была бы циклом без эффекта.
- Домен `opt` — не затрагивается (нет реализованной функциональности).

## Decisions

**1. `Task` → `AggregateRoot`, публикует `TaskClosedDomainEvent` при ЛЮБОМ терминальном переходе.**
   `transitionTo()` (`task.entity.ts`) после успешной мутации статуса, если `next.isTerminal()`,
   вызывает `this.addEvent(new TaskClosedDomainEvent(this.id, next.code))`. Событие несёт только
   `taskId` и `status` (`TaskStatusCode`) — минимум, достаточный подписчику.

   Альтернатива (отклонена): публиковать отдельные `TaskClosedSuccessfullyDomainEvent`/
   `TaskClosedUnsuccessfullyDomainEvent`. Отклонено — сейчас есть только один потребитель одного из
   двух исходов; отдельные классы событий под каждый статус добавили бы структуру без текущей пользы
   (YAGN). Единое событие + фильтрация по `status` на стороне подписчика проще и достаточно, если
   позже понадобится реагировать и на `CLOSED_SUCCESSFULLY` — фильтр в handler'е просто расширяется.

   Именование — по существующей конвенции модуля (`AccountingPeriodClosedDomainEvent`,
   `MotivationSchemaCreatedDomainEvent`): `<Сущность><ПрошедшееВремя>DomainEvent`, публикуется через
   `EventEmitter2.emitAsync(event.constructor.name, event)` (см. `AggregateRoot.publishEvents`), т.е.
   строка события для `@OnEvent` — `'TaskClosedDomainEvent'`.

   Файл: `backend/src/modules/tasks/domain/events/task-closed.domain-event.ts` (у `tasks` пока нет
   папки `domain/events/` — заводится этим изменением, по образцу `accounting/domain/events/`).

**2. Обработка в `accounting` — два зеркальных `@OnEvent`-хендлера (`service`, `shop`), не общий класс.**
   Соответствует уже устоявшемуся правилу изоляции `service`/`shop` (`backend/CLAUDE.md`, «Общие
   таблицы между service и shop»; корневой `CLAUDE.md`, раздел про межмодульные зависимости) — оба
   домена независимо читают то же самое событие `tasks` и работают каждый только со своими правилами.

   - `backend/src/domains/service/modules/accounting/application/events/task-completion/task-closed.event-handler.ts`
   - `backend/src/domains/shop/modules/accounting/application/events/task-completion/task-closed.event-handler.ts`

   Логика (идентична в обоих, независимые реализации):
   ```
   if (event.status !== 'CLOSED_UNSUCCESSFULLY') return;
   const rule = await salaryRuleRepo.findOneOffByAnyTaskId(event.taskId);
   if (!rule) return;                 // задача не привязана к правилу этого домена
   if (!rule.isActive) return;        // уже неактивно — no-op
   rule.deactivate();
   await salaryRuleRepo.update(rule);
   ```
   Ошибка обработчика логируется, не ретраится и не блокирует исходную транзакцию закрытия задачи —
   событие публикуется уже ПОСЛЕ коммита (см. `DatabaseService.withTransaction`), откат исходной
   транзакции из-за сбоя реакции невозможен и не нужен.

**3. Новый репозиторный метод `findOneOffByAnyTaskId(taskId)`, а не переиспользование `findByTaskId`.**
   `findByTaskId` (существующий, `salary-rule.repository.ts:75-88`) ищет только
   `taskIdByPeriod[Period.current()]` — годится для панели связей задачи (see выше), но не для этого
   сценария: разовое правило может быть создано в прошлом периоде, задача закрывается позже. Новый
   метод сканирует **все** значения `Object.values(config.taskIdByPeriod)` (без ограничения по
   периоду) и дополнительно фильтрует `config.isRecurring === false` в самом запросе/маппинге — тем
   же приёмом полного сканирования правил `TaskCompletion` направления, что и `findByTaskId` (см.
   комментарий design.md решение 4 у `findByTaskId` — правил этого вида на домен ожидаемо мало,
   отдельная индексная таблица не нужна).

   Добавляется в `SalaryRuleRepositoryPort` (`service`) и его аналог в `shop`, реализуется в
   `SalaryRuleRepository`/аналоге `shop`.

**4. `SetTaskCompletionLineRewardHandler` деактивирует правило синхронно, тем же вызовом.**
   После `accrual.setLineManualReward(...)` — если `rule.config.isRecurring === false` и
   `rule.isActive`, вызывает `rule.deactivate()` и персистит через `SalaryRuleRepositoryPort.update()`
   в той же операции (не отдельная транзакция/событие — весь контекст, включая `rule`, уже загружен
   этим handler'ом). Симметрично реализуется в зеркальном `shop`-обработчике.

## Risks / Trade-offs

- **[Риск] Гонка: задача закрывается неуспешно почти одновременно с ручной фиксацией начисления по
  той же задаче (маловероятно для одной и той же задачи, но не исключено при повторном
  редактировании строки).** → Обе ветки идемпотентны (`if (!rule.isActive) return`) — второй вызов
  просто не находит, что менять. Не требует блокировок.
- **[Риск] Полное сканирование правил `TaskCompletion` домена при каждом `TaskClosedDomainEvent`
  (тот же паттерн, что уже принят для `findByTaskId`).** → Приемлемо по той же причине, что и для
  существующего метода — правил вида `TaskCompletion` на домен ожидаемо мало; если станет узким
  местом, заводится по факту (индекс/материализованная связь), не заранее.
- **[Риск] `Task` меняет базовый класс (`Entity` → `AggregateRoot`) — затрагивает существующие тесты
  и, потенциально, любой код, полагающийся на текущий тип `Task`.** → `AggregateRoot<EntityProps>`
  сам наследует `Entity<EntityProps>` (см. `aggregate-root.base.ts:7`), публичный контракт `Task` не
  меняется, только добавляется возможность публикации событий — обратная совместимость сохраняется.
- **[Trade-off] Одно общее событие `TaskClosedDomainEvent` вместо специализированных по статусу.** →
  см. Decision 1 — сознательный выбор в пользу меньшей структуры сейчас; если появится третий
  потребитель с другой семантикой по статусу, специализация делается тогда.

## Open Questions

(нет — оставшиеся неопределённости из предыдущего обсуждения разрешены решениями выше)
