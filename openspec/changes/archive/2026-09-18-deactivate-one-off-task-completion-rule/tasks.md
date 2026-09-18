## 1. `Task` публикует `TaskClosedDomainEvent` при терминальном переходе

- [x] 1.1 Написать тесты на `Task.transitionTo()` (`task.entity.spec.ts`): переход в «Закрыто неуспешно»
  добавляет в `domainEvents` ровно один `TaskClosedDomainEvent` с `taskId`/`status = 'CLOSED_UNSUCCESSFULLY'`;
  переход в «Закрыта успешно» — аналогично со `status = 'CLOSED_SUCCESSFULLY'`; НЕтерминальный переход
  (например «Новая» → «В работе») не добавляет событий; `cancelForRuleDeletion()` НЕ добавляет событий
  (см. design.md Non-Goals) — и убедиться, что тест-раннер их видит
- [x] 1.2 Прогнать тесты из 1.1 и зафиксировать, что они падают (red) по ожидаемой причине — `Task` ещё
  наследует `Entity`, у него нет `domainEvents`/`addEvent`
- [x] 1.3 Создать `backend/src/modules/tasks/domain/events/task-closed.domain-event.ts`
  (`TaskClosedDomainEvent`, поля `taskId: string`, `status: TaskStatusCode`), перевести `Task`
  (`task.entity.ts`) с `Entity<TaskProps>` на `AggregateRoot<TaskProps>` и вызвать
  `this.addEvent(new TaskClosedDomainEvent(this.id, next.code))` в `transitionTo()` при
  `next.isTerminal()` — сигнатура `transitionTo`/`cancelForRuleDeletion` не меняется
- [x] 1.4 Прогнать тесты из 1.1 и зафиксировать, что они зелёные (green); прогнать полный набор тестов
  `backend/src/modules/tasks` и убедиться, что переход `Task` на `AggregateRoot` не сломал существующие
  тесты (`cancel-task-for-rule-deletion.service.spec.ts`, `change-task-status.handler.spec.ts` и т.п.)

## 2. `SalaryRuleRepositoryPort.findOneOffByAnyTaskId` — `service`

- [x] 2.1 Написать тесты на `SalaryRuleRepository.findOneOffByAnyTaskId(taskId)`
  (`salary-rule.repository.spec.ts`, домен `service`): находит разовое (`isRecurring: false`) правило
  `TaskCompletion`, у которого `taskId` встречается в ЛЮБОМ значении `config.taskIdByPeriod` (не только
  текущий период); возвращает `null`, если совпадений нет, если правило регулярное, или если `taskId`
  принадлежит правилу другого направления (`direction`) — и убедиться, что тест-раннер их видит
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать, что они падают (red) — метода ещё нет ни в порту, ни в
  реализации
- [x] 2.3 Добавить `findOneOffByAnyTaskId(taskId: string): Promise<SalaryRule | null>` в
  `SalaryRuleRepositoryPort` (`application/ports/motivation-schema/salary-rule.port.ts`) и реализовать в
  `SalaryRuleRepository` (`infrastructure/repositories/motivation-schema/salary-rule.repository.ts`) —
  тем же приёмом полного сканирования правил `TaskCompletion` направления `service`, что и у
  существующего `findByTaskId`, но без ограничения по текущему периоду и с фильтром `isRecurring === false`
- [x] 2.4 Прогнать тесты из 2.1 и зафиксировать, что они зелёные (green), регрессий в соседних тестах
  `salary-rule.repository.spec.ts` нет

## 3. `SalaryRuleRepositoryPort.findOneOffByAnyTaskId` — `shop`

- [x] 3.1 Написать тесты на `ShopSalaryRuleRepository.findOneOffByAnyTaskId(taskId)` — то же поведение,
  что в группе 2, для направления `shop` — и убедиться, что тест-раннер их видит
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать, что они падают (red)
- [x] 3.3 Добавить `findOneOffByAnyTaskId` в `ShopSalaryRuleRepositoryPort` и реализовать в
  `ShopSalaryRuleRepository` — независимая реализация, зеркальная группе 2, без переиспользования кода
  `service`
- [x] 3.4 Прогнать тесты из 3.1 и зафиксировать, что они зелёные (green), регрессий нет

## 4. `TaskClosedEventHandler` деактивирует разовое правило при неуспехе — `service`

- [x] 4.1 Написать тесты на `TaskClosedEventHandler` (`service`, соответствует
  `specs/service/accounting/spec.md` — Requirement «Разовое правило «за выполнение задачи»
  деактивируется по исходу задачи», сценарии «Неуспешное закрытие задачи деактивирует разовое правило»,
  «Регулярное правило не деактивируется», «Уже неактивное правило повторно не деактивируется»): при
  `TaskClosedDomainEvent{status: 'CLOSED_UNSUCCESSFULLY'}` и найденном активном разовом правиле —
  вызывает `rule.deactivate()` и персистит; при `status: 'CLOSED_SUCCESSFULLY'` — no-op; когда правило не
  найдено (`findOneOffByAnyTaskId` вернул `null`, задача не привязана к правилу этого направления) —
  no-op; когда найденное правило уже неактивно — no-op, `update()` не вызывается — и убедиться, что
  тест-раннер их видит
- [x] 4.2 Прогнать тесты из 4.1 и зафиксировать, что они падают (red) — хендлера ещё нет
- [x] 4.3 Создать
  `backend/src/domains/service/modules/accounting/application/events/task-completion/task-closed.event-handler.ts`
  (`@OnEvent('TaskClosedDomainEvent')`), реализовать логику по design.md Decision 2, зарегистрировать
  провайдер в `accounting.module.ts`
- [x] 4.4 Прогнать тесты из 4.1 и зафиксировать, что они зелёные (green), регрессий в
  `application/events/**` домена `service` нет

## 5. `TaskClosedEventHandler` деактивирует разовое правило при неуспехе — `shop`

- [x] 5.1 Написать тесты на `TaskClosedEventHandler` (`shop`) — то же поведение, что в группе 4, по
  `specs/shop/accounting/spec.md` — и убедиться, что тест-раннер их видит
- [x] 5.2 Прогнать тесты из 5.1 и зафиксировать, что они падают (red)
- [x] 5.3 Создать
  `backend/src/domains/shop/modules/accounting/application/events/task-completion/task-closed.event-handler.ts`,
  независимая реализация, зеркальная группе 4, зарегистрировать в `accounting.module.ts` домена `shop`
- [x] 5.4 Прогнать тесты из 5.1 и зафиксировать, что они зелёные (green), регрессий нет

## 6. Деактивация разового правила при фиксации начисления — `service`

- [x] 6.1 Написать тесты на `SetTaskCompletionLineRewardHandler` (`service`, по
  `specs/service/accounting/spec.md` — сценарии «Фиксация начисления деактивирует разовое правило»,
  «Успешное закрытие задачи само по себе не деактивирует правило», «Регулярное правило не
  деактивируется…», «Уже неактивное правило повторно не деактивируется»): после
  `accrual.setLineManualReward(...)` для активного разового правила вызывается `rule.deactivate()` и
  `salaryRuleRepo.update(rule)`; для регулярного правила или уже неактивного разового — `update()` по
  `rule.isActive`/`deactivate()` не вызывается — и убедиться, что тест-раннер их видит
- [x] 6.2 Прогнать тесты из 6.1 и зафиксировать, что они падают (red) по ожидаемой причине
- [x] 6.3 Дополнить `SetTaskCompletionLineRewardHandler`
  (`application/command/salary-accrual/set-task-completion-line-reward.handler.ts`) по design.md
  Decision 4: после сохранения суммы — если `rule.config.isRecurring === false && rule.isActive`,
  вызвать `rule.deactivate()` и `salaryRuleRepo.update(rule)`
- [x] 6.4 Прогнать тесты из 6.1 и зафиксировать, что они зелёные (green), регрессий в
  `salary-accrual/**` домена `service` нет

## 7. Деактивация разового правила при фиксации начисления — `shop`

- [x] 7.1 Написать тесты на `SetTaskCompletionLineRewardHandler` (`shop`) — то же поведение, что в
  группе 6, по `specs/shop/accounting/spec.md` — и убедиться, что тест-раннер их видит
- [x] 7.2 Прогнать тесты из 7.1 и зафиксировать, что они падают (red)
- [x] 7.3 Дополнить `SetTaskCompletionLineRewardHandler` домена `shop` — независимая реализация,
  зеркальная группе 6
- [x] 7.4 Прогнать тесты из 7.1 и зафиксировать, что они зелёные (green), регрессий нет

## 8. Финальная проверка

- [x] 8.1 Прогнать `npm run test` (весь backend) и убедиться, что нет регрессий за пределами
  `modules/tasks` и `domains/{service,shop}/modules/accounting`
- [x] 8.2 Прогнать `npx tsc --noEmit` (или `npm run build`) и убедиться, что перевод `Task` на
  `AggregateRoot` не сломал типизацию в местах, читающих `Task` вне `modules/tasks` (в частности
  `TASK_REPOSITORY`-потребители в `domains/{service,shop}/modules/accounting`)
