# Architecture: deactivate-one-off-task-completion-rule

## Scope

Изменение целиком на бэкенде: модуль `tasks` начинает публиковать доменное событие при терминальном
переходе задачи, а модули `accounting` (`service` и `shop`) реагируют на него и на фиксацию
начисления деактивацией разового правила `TaskCompletion`. Фронтенд не затрагивается.

---

## Backend — Domain Model

### Entities

| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `Task` (`backend/src/modules/tasks/domain/entities/task.entity.ts`) | existing, меняет базовый класс `Entity` → `AggregateRoot` | да (было — нет) | `id`, `status: TaskStatus`, `closedSuccessfullyAt` | Публикует `TaskClosedDomainEvent` из `transitionTo()` при переходе в терминальный статус |
| `TaskCompletion` (`.../accounting/domain/entities/salary-rules/task-completion.entity.ts`, `service` и `shop`) | existing | нет (часть агрегата `SalaryRule`) | `config.taskIdByPeriod`, `config.isRecurring`, `isActive` | Деактивируется (`deactivate()`, уже существующий метод) по одному из двух новых триггеров |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `Task` | `Task` | — | Изменений в составе нет; добавляется способность публиковать доменные события после смены базового класса |
| `SalaryRule` (существующий) | `SalaryRule` | `TaskCompletion` (один из видов правила) | Не позволяет деактивировать уже неактивное правило повторно (идемпотентность `deactivate()`, уже существующая) |

### Value Objects

| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| — | — | Новых VO нет: `TaskStatusCode` (используется в событии) — уже существующий тип, не вводится заново |

### Services

| Service | Слой (application/domain/infrastructure) | Ответственность |
|---|---|---|
| `TaskClosedDomainEvent` (`backend/src/modules/tasks/domain/events/task-closed.domain-event.ts`) | domain (new) | Несёт факт терминального перехода задачи (`taskId`, `status`) наружу модуля `tasks` |
| `TaskClosedEventHandler` (`.../service/modules/accounting/application/events/task-completion/task-closed.event-handler.ts`) | application (new) | Подписан на `TaskClosedDomainEvent`; при `status === 'CLOSED_UNSUCCESSFULLY'` находит и деактивирует разовое правило `service` по `taskId` |
| `TaskClosedEventHandler` (`.../shop/modules/accounting/application/events/task-completion/task-closed.event-handler.ts`) | application (new) | То же самое, независимая реализация для `shop` |
| `SetTaskCompletionLineRewardHandler` (`.../accounting/application/command/salary-accrual/set-task-completion-line-reward.handler.ts`, `service` и `shop`) | application (existing) | Дополняется: после фиксации суммы начисления деактивирует разовое правило, если оно ещё активно |
| `SalaryRuleRepository` (`.../accounting/infrastructure/repositories/motivation-schema/salary-rule.repository.ts`, `service` и `shop`) | infrastructure (existing) | Дополняется новым методом `findOneOffByAnyTaskId` |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `Task.transitionTo` | `next: TaskStatus, actorEmployeeId: string` | `void` | Существующая сигнатура не меняется; при `next.isTerminal()` дополнительно вызывает `this.addEvent(new TaskClosedDomainEvent(this.id, next.code))` |
| `TaskClosedEventHandler.handle` | `event: TaskClosedDomainEvent` | `Promise<void>` | `@OnEvent('TaskClosedDomainEvent')`; фильтрует по статусу, находит правило, деактивирует, персистит |
| `SalaryRuleRepositoryPort.findOneOffByAnyTaskId` (`service`, `shop`) | `taskId: string` | `Promise<SalaryRule \| null>` | Сканирует правила `TaskCompletion` домена, ищет совпадение `taskId` в ЛЮБОМ значении `config.taskIdByPeriod` (не только текущий период, в отличие от существующего `findByTaskId`), возвращает только если `config.isRecurring === false` |
| `SetTaskCompletionLineRewardHandler.execute` | `command: SetTaskCompletionLineRewardCommand` | `Promise<void>` | Существующая сигнатура не меняется; после `accrual.setLineManualReward(...)` дополнительно: если правило разовое и активно — `rule.deactivate()` + `salaryRuleRepo.update(rule)` |

---

## Frontend — UI Model

Изменение полностью бэкендовое — новых экранов, фич, компонентов или хуков не появляется.
Существующий UI, отображающий состояние `isActive` правила (если оно уже показывается где-либо в
панели зарплатных правил), продолжит работать без изменений кода фронтенда — он просто начнёт
отражать новое авто-выставляемое значение, пришедшее с бэкенда.

### Pages

| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| — (нет затронутых страниц — поведение полностью на бэкенде) | | | |

### Features (переиспользуемые модули с бизнес-логикой)

| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| — (нет затронутых фич) | | | | |

### UI-компоненты (page-local и shared)

| Component | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные) | Назначение |
|---|---|---|---|
| — (нет новых/изменённых компонентов) | | | |

### Hooks (model)

| Hook | Расположение | Тип (state-хук / query options factory) | Возвращает |
|---|---|---|---|
| — (нет новых/изменённых хуков) | | | |

### Паттерны, которые нужно учесть при проектировании
- [ ] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента)
- [ ] Запросы к backend — через query options factory в `model/api.ts` (`queryOptions({...})`), не голыми async-функциями
- [ ] Ошибки API нормализуются через `ApiError` (`shared/errors/apiError.ts`) в `.catch()` запроса
- [ ] Для страницы с несколькими stateful-виджетами — `mediator/`-компонент без условного рендера
- [ ] Layout/контейнерные компоненты принимают именованные слоты (`header`/`body`/`footer`), а не `children`
- [ ] Разделение `isInitialLoad` / `isRefreshing` вместо одного `isLoading`, если фильтры не должны "схлопывать" уже отрисованные данные
- [ ] Новые компоненты — в `shared/ui-kit/` (новые токены), не в `shared/ui/` (легаси shadcn)

<!-- Ни один пункт не отмечен — фронтенд этим изменением не затрагивается -->

---

## Diagrams

Пропущено по решению пользователя — Miro-доска для этого change не создавалась.

---

## Confirmation Checklist
- [ ] Названия entity/aggregate/VO согласованы
- [ ] Названия и сигнатуры ключевых методов сервисов согласованы
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы — не применимо, фронтенд не затронут
- [x] Диаграммы взаимодействия — пропущены по решению пользователя
- [x] Пользователь подтвердил переход к tasks.md
