# Architecture: add-task-based-salary-rule

## Scope
Новый тип зарплатного правила `TaskCompletion` в `service/accounting` и `shop/accounting`
(независимые зеркальные реализации) + новая сквозная инфраструктура работы с задачами Bitrix24
(`src/integrations/bitrix/`, новый cron-синк). На фронтенде — расширение уже существующих фич
`SalaryRuleForm` и `SalaryAccruals`, без новых страниц/роутов.

---

## Backend — Domain Model

### Entities
| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `TaskCompletion` (service) | new | нет (часть `MotivationSchema`) | `targetRole`, `isRecurring`, `deadlineTemplate` | Новый подтип `SalaryRule` — правило «за выполнение задачи», `service` |
| `TaskCompletion` (shop) | new | нет (часть `MotivationSchema`) | те же поля | Зеркальная независимая реализация для `shop` |
| `SalaryTask` (service) | new | да | `salaryRuleId`, `direction`, `period`, `deadline`, `bitrixTaskId`, `taskStatus`, `lastSyncedAt` | Отслеживает конкретный экземпляр задачи Bitrix24 за период, `service` |
| `SalaryTask` (shop) | new | да | те же поля | Зеркальная реализация для `shop`, поверх той же Prisma-таблицы (`direction=shop`) |
| `MotivationSchema` | existing | да | — | Без изменений структуры — принимает новый тип правила в список |
| `SalaryAccrualLine` | existing (расширяется) | нет (часть `SalaryAccrual`) | `+comment: string?`, `+requiresManualInput: bool` (новые поля) | Для строк типа `TaskCompletion` — держит ручной ввод суммы/комментария |

### Aggregates
| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `MotivationSchema` (existing) | `MotivationSchema` | `SalaryRule` (в т.ч. новый `TaskCompletion`) | Набор правил принадлежит одной схеме мотивации |
| `SalaryTask` (new, ×2 — service/shop) | `SalaryTask` | `TaskStatus` VO | Не более одной задачи на `(salaryRuleId, period)`; закрытая/удалённая задача не пересоздаётся автоматически |
| `SalaryAccrual` (existing) | `SalaryAccrual` | `SalaryAccrualLine`, `SalaryAccrualLineAdjustment`, новый `ManualAccrualInput` VO | Строка `TaskCompletion` не может быть проведена (`DRAFT → ACCRUED`) без заполненных суммы и комментария |

### Value Objects
| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `TaskStatus` (new, ×2) | `code: string`, `isDone(): bool` | Ограниченный набор статусов Bitrix24 + вычисляемая проекция «выполнено/нет» — не голая строка |
| `ManualAccrualInput` (new, ×2) | `amount: Money`, `comment: string` (обязателен, непустой) | Поля всегда вводятся и валидируются вместе (сумма без комментария — невалидное состояние строки) |

### Services
| Service | Слой (application/domain/infrastructure) | Ответственность |
|---|---|---|
| `EnsureSalaryTaskForPeriodService` (new, ×2) | application | Идемпотентное создание/пересоздание `SalaryTask` на период (cron + ленивый вызов) |
| `SalaryTaskRepositoryPort` / `SalaryTaskRepository` (new, ×2 — свой Prisma-репозиторий на домен) | application (порт) / infrastructure | Персистентность `SalaryTask` (INSERT/UPDATE строки `salary_tasks`), каждый репозиторий фильтрует/подставляет свой `direction` |
| `BitrixTasksGatewayPort` (new, **1 общий**, не по домену) | application — интерфейс без логики, не сервис (`src/integrations/bitrix/ports/bitrix-tasks-gateway.port.ts`) | Контракт `createTask`/`closeTask`/`updateDeadline` для доменного слоя; направление не участвует в контракте — задача не связана с shared-таблицами, изолировать по `direction` нечего |
| `BitrixTasksGatewayAdapter` (new, единственная реализация) | infrastructure (`src/integrations/bitrix/bitrix-tasks-gateway.adapter.ts`) | Реализует `BitrixTasksGatewayPort`, делегирует в `BitrixService` (существующий класс, расширяется — без отдельного `BitrixTasksService`). Регистрируется под токеном `BITRIX_TASKS_GATEWAY` в `BitrixModule` (`src/integrations/bitrix/bitrix.module.ts`) и экспортируется оттуда; `accounting.module.ts` **обоих** доменов импортирует `BitrixModule`, чтобы получить токен — по тому же паттерну, что уже используют `src/modules/auth`, `src/modules/employee-identity`, `src/sync/bitrix` |
| `BitrixService` (**existing, расширяется** — новые методы задач, отдельный класс не заводится) | infrastructure (`src/integrations/bitrix/bitrix.service.ts`) | К уже существующим read-методам (`fetchCreatedDeals`, `fetchEmployees`, ...) добавляются `createTask`/`closeTask`/`updateTaskDeadline`/`fetchTaskStatusesBatch` — write/read-обёртка над `tasks.task.add/update/get`; использует тот же `BitrixHttpService`, что и остальные методы класса; используется и адаптером порта, и `SalaryTaskStatusSyncCron` напрямую |
| `SalaryTaskStatusSyncCron` + сервис (new, общий, cross-cutting) | infrastructure (`src/sync/bitrix-tasks/`) | `@ProdCron(EVERY_5_MINUTES)`, батчем опрашивает статусы всех активных `SalaryTask` обоих направлений, пишет `taskStatus`/`lastSyncedAt` |
| `CreateSalaryRuleHandler` (existing, расширяется ×2) | application | При `type=TaskCompletion` — создаёт задачу через (общий) `BitrixTasksGatewayPort` до записи в БД (см. D3) |
| `UpdateMotivationSchemaHandler` (existing, расширяется ×2) | application | При удалении правила `TaskCompletion` из схемы — закрывает связанную задачу через (общий) гейтвей |
| `SetTaskCompletionLineRewardHandler` (new, ×2, `application/command/salary-accrual/`) | application | Ручной ввод суммы+комментария в `SalaryAccrualLine` (по образцу соседних `accrue-salary-accrual-line`/`adjust-salary-accrual-line`) |
| `PeriodCalculationOrchestrator` (existing, **минимально расширяется** — уточнение по факту ревью tasks.md) | domain | `rule.calculate()` может вернуть `null` (пока `TaskCompletion` не готов), а текущий `calculate()`/`total()` этого не ожидают — `push(await rule.calculate(...))` кладёт `null` в массив, `total()` падает на `line.amount`. Нужен `.filter(Boolean)`/эквивалент перед суммированием и в местах, зависящих от позиционного соответствия `rules[i]`↔`lines[i]` (`buildRuleBreakdown`/`buildSalaryReportRules`). Поведение существующих типов правил не меняется — они никогда не возвращают `null` |
| `build-service-calculation-context.service.ts` / `build-shop-calculation-context.service.ts` (existing, расширяется) | application | Догружает `erpData` статусом связанных `SalaryTask` перед вызовом оркестратора |
| `buildBitrixTaskLink` (new, **1 общий**, не по домену) | domain (utility) | Строит ссылку на задачу в Bitrix24 по `bitrixTaskId`; по аналогии с `erp-order-link-builder.ts` (`buildErpOrderLink`), но не дублируется — URL не зависит от направления (см. design.md Decision 7) |

### Method Signatures (ключевые, по каждому сервису)
| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `EnsureSalaryTaskForPeriodService.ensure` | `direction, salaryRuleId, period` | `Promise<SalaryTask>` | Идемпотентно создаёт (или возвращает уже существующую) `SalaryTask` на период |
| `SalaryTaskRepository.save` | `salaryTask: SalaryTask` | `Promise<void>` | Сохраняет `SalaryTask` (в т.ч. `bitrixTaskId`) в той же транзакции `UNIT_OF_WORK`, что и `SalaryRule` — см. D3 |
| `BitrixTasksGatewayPort.createTask` | `{ responsibleBitrixUserId, title, description, deadline }` | `Promise<{ bitrixTaskId: string }>` | Создаёт задачу в Bitrix24 |
| `BitrixTasksGatewayPort.closeTask` | `bitrixTaskId: string` | `Promise<void>` | Закрывает/отменяет задачу в Bitrix24 |
| `BitrixTasksGatewayPort.updateDeadline` | `bitrixTaskId, deadline` | `Promise<void>` | Синхронизирует новый дедлайн в Bitrix24 |
| `BitrixService.fetchTaskStatusesBatch` | `bitrixTaskIds: string[]` | `Promise<Map<string, TaskStatus>>` | Один batch-запрос статусов вместо N вызовов |
| `TaskCompletion.calculate` | `context: CalculationContext` | `CalculationLine \| null` | `null`, пока связанная `SalaryTask.taskStatus.isDone() === false`; иначе — линия с `sources: [{ type: 'taskCompletion', id: bitrixTaskId, label, link: buildBitrixTaskLink(bitrixTaskId) }]` |
| `buildBitrixTaskLink` | `bitrixTaskId: string` | `string` (URL) | `https://<портал>.bitrix24.ru/.../tasks/task/view/<id>/` — по аналогии с `buildErpOrderLink` |
| `SetTaskCompletionLineRewardHandler.execute` | `{ lineId, amount, comment }` | `Promise<void>` | Валидирует и сохраняет `ManualAccrualInput` на строку, снимает `requiresManualInput` |

---

## Frontend — UI Model

### Pages
| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| `SalaryRuleDetail` (existing, расширяется) | `salaries/rules/new`, `salaries/rules/:direction/:id` | уже есть mediator | Добавление типа `TaskCompletion` в форму создания/редактирования правила |
| `SalaryAccrualDocument` (existing, расширяется) | `salary-accruals/:id` | уже есть mediator | Ручной ввод суммы/комментария для строк `TaskCompletion` |
| `SalaryReportV2` (existing, не меняется структурно) | — | — | Строка `TaskCompletion` рендерится как обычная строка отчёта; название задачи и ссылка на неё в Bitrix24 — в детализации строки (`RuleSourcesRail.tsx`), тем же механизмом, что уже показывает ссылку на заказ (никаких изменений компонента не требуется, см. UI-компоненты) |

### Features (переиспользуемые модули с бизнес-логикой)
| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `SalaryRuleForm` | existing, расширяется | `frontend/src/features/SalaryRuleForm/index.ts` | `service/model/{ruleTypes.ts,ruleFormSchema.ts}` + `shop/model/{ruleTypes.ts,ruleFormSchema.ts}` — добавляется вариант `TaskCompletion` (поля `deadline`, `isRecurring`) в оба направления | Создание/редактирование зарплатного правила |
| `SalaryAccruals` | existing, расширяется | `frontend/src/features/SalaryAccruals/index.ts` | `model/api.ts` — новая мутация `setTaskCompletionLineReward`; `model/useAccrualMutations.ts` — расширяется | Работа с документом начисления, включая ручной ввод по `TaskCompletion`-строкам |

### UI-компоненты (page-local и shared)
| Component | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные) | Назначение |
|---|---|---|---|
| `TaskCompletionRuleFields` | `SalaryRuleForm/ui/RuleFormCard/` (new) | `deadline`, `isRecurring`, `onChange` | Поля формы, специфичные для типа `TaskCompletion` |
| `SetTaskRewardModal` | `SalaryAccruals/ui/` (new, по образцу `AdjustLineModal.tsx`) | `line`, `onSubmit(amount, comment)` | Модалка ручного ввода суммы+комментария при первом проведении строки |
| `TaskStatusBadge` | `SalaryAccruals/ui/` (new, по образцу `AccrualStatusBadge.tsx`, поверх `shared/ui-kit/atoms/Badge.tsx`) | `status: TaskStatus` | Бейдж «Выполнено / В работе / Просрочено» (только статус, не ссылка — ссылка на задачу отдельно, см. ниже); переиспользуется в `SalaryRuleDetail` и `SalaryReportV2`, как уже переиспользуется `AccrualStatusBadge` |
| _(изменений не требуется)_ `AccrualLineSources.tsx` / `RuleSourcesRail.tsx` | `SalaryAccruals/ui/` · `pages/SalaryReportV2/ui/` (existing) | — | Название задачи + кликабельная ссылка на неё в Bitrix24 — тот же универсальный рендер `source.label`/`source.link`, что уже показывает ссылку на заказ у `OrderPayed`/`ServiceCompleted`; `RuleSourcesRail.tsx` уже содержит `taskCompletion: 'Задача'` в `SOURCE_TYPE_LABELS` (остаток прежней реализации). Данные приходят из `CalculationLine.sources[]`, см. Method Signatures — `TaskCompletion.calculate` |

### Hooks (model)
| Hook | Расположение | Тип (state-хук / query options factory) | Возвращает |
|---|---|---|---|
| `useSetTaskCompletionLineReward` | `SalaryAccruals/model/useAccrualMutations.ts` (new export) | mutation-хук поверх `api.ts` | `{ mutate, isPending, error }` |
| `useSalaryRuleTypes` / `useShopSalaryRuleTypes` | `SalaryRuleForm/service|shop/model/` (existing, расширяется списком типов) | query options factory | список доступных типов правил, включая `TaskCompletion` |

### Паттерны, которые нужно учесть при проектировании
- [x] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента)
- [x] Запросы к backend — через query options factory в `model/api.ts` (`queryOptions({...})`), не голыми async-функциями
- [x] Ошибки API нормализуются через `ApiError` (`shared/errors/apiError.ts`) в `.catch()` запроса
- [x] Для страницы с несколькими stateful-виджетами — `mediator/`-компонент без условного рендера (уже есть у обеих страниц, не пересоздаётся)
- [ ] Layout/контейнерные компоненты принимают именованные слоты — не затрагивается (новых layout-контейнеров не вводится)
- [ ] Разделение `isInitialLoad` / `isRefreshing` — не затрагивается (новые мутации, не списочные query с фильтрами)
- [x] Новые компоненты — в `shared/ui-kit/` (расширение `Badge.tsx` новым `tone`), доменные обёртки — в `ui/` фичи, не в `shared/ui/` (легаси)

---

## Diagrams

### 1. Domain Entity Interaction
Miro link: `https://miro.com/app/board/uXjVHzbvWv0=/?moveToWidget=3458764682933022411`

### 2. External Modules Interaction
Miro link: `https://miro.com/app/board/uXjVHzbvWv0=/?moveToWidget=3458764682933022409`

### 3. Layer Interaction — от Controller до Response
Miro link: `https://miro.com/app/board/uXjVHzbvWv0=/?moveToWidget=3458764682933022410`

Все три диаграммы размещены на существующей доске **«iReports — service/accounting»** новым рядом
ниже уже существующих D1–D5 диаграмм модулей `service/accounting`/`service/sales`, с явной пометкой
`(change)` в заголовке.

---

## Confirmation Checklist
- [ ] Названия entity/aggregate/VO согласованы
- [ ] Названия и сигнатуры ключевых методов сервисов согласованы
- [ ] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [ ] Диаграммы взаимодействия отражают ожидаемую реализацию
- [ ] Пользователь подтвердил переход к tasks.md
