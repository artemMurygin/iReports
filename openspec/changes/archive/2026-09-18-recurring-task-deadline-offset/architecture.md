# Architecture: recurring-task-deadline-offset

## Scope

Затрагивает правило «за выполнение задачи» (`TaskCompletion`) в обоих доменах —
`domains/service/modules/accounting` и `domains/shop/modules/accounting` (независимые копии, см.
`backend/CLAUDE.md`) — плюс общий `Period` VO в `src/shared/domain/`, контракты `ireports-contracts`
и форму `SalaryRuleForm` на фронте. Новых модулей/агрегатов не вводится; изменение — новое поле
конфигурации правила + новый VO для его валидации + правка двух уже существующих чистых функций
вычисления дедлайна.

Диаграммы на Miro-доске сознательно не создавались (решение пользователя при написании этого
артефакта) — изменение не вводит новых сущностей/агрегатов и не меняет внешние/межслойные
взаимодействия, полноценные диаграммы не добавляют информации сверх таблиц ниже.

---

## Backend — Domain Model

### Entities

| Name | Status | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `TaskCompletion` (`domains/service/.../domain/entities/salary-rules/task-completion.entity.ts`) | existing, модифицируется | да | `config: TaskCompletionSalaryConfig` (в `config` добавляется `deadlinePeriodOffset: DeadlinePeriodOffset`) | Правило «за выполнение задачи», направление `service` |
| `TaskCompletionShop` (`domains/shop/.../domain/entities/salary-rules/task-completion.entity.ts`) | existing, модифицируется | да | `config: TaskCompletionShopSalaryConfig` (то же поле) | Правило «за выполнение задачи», направление `shop` |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `TaskCompletion` (service) | `TaskCompletion` | `TaskCompletionSalaryConfig` (plain props), новый `DeadlinePeriodOffset` VO | Смещение дедлайна регулярной задачи — целое число в диапазоне `[0, 3]` |
| `TaskCompletionShop` (shop) | `TaskCompletionShop` | `TaskCompletionShopSalaryConfig` (plain props), новый `DeadlinePeriodOffset` VO (собственная копия) | То же самое, независимо от `service` |

### Value Objects

| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `DeadlinePeriodOffset` (новый, отдельная копия в `domains/service/.../domain/value-objects/` и `domains/shop/.../domain/value-objects/`) | `value: number` (целое, `0..3`) | Собственный инвариант-диапазон (см. `backend/CLAUDE.md`, правило про VO для полей с валидацией диапазона): некорректное значение (дробное, отрицательное, > 3) должно быть невозможно построить, а не проверяться россыпью в разных местах (zod-схема запроса, мапперы, вычисление дедлайна) |

### Services

| Service | Слой | Ответственность |
|---|---|---|
| `computeDeadlineForPeriod` (`domains/service/.../application/services/task-completion/ensure-rule-task-for-period.service.ts`) | application (существующее размещение — не переносится в этом изменении) | Вычисляет дедлайн новой задачи регулярного правила на период; **модифицируется**: учитывает `deadlinePeriodOffset` |
| `computeRecurringTaskDeadline` (`domains/shop/.../domain/services/task-deadline.ts`) | domain | То же для `shop`; **модифицируется** |
| `Period.shiftMonths` (`src/shared/domain/period.value-object.ts`) | shared domain (общий строительный блок, не бизнес-специфичный) | **Новый метод**: возвращает `Period`, сдвинутый на `n` месяцев вперёд (обобщение существующего `previous()`) |

### Method Signatures

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `Period.shiftMonths` | `offset: number` (может быть отрицательным) | `Period` | Период, сдвинутый на `offset` месяцев; переносит год через `Date.UTC` |
| `computeDeadlineForPeriod` (service) | `deadlineTemplate: string`, `deadlinePeriodOffset: number`, `period: string` | `Date` | Число месяца и время — из `deadlineTemplate`; год/месяц — из `Period.create(period).shiftMonths(deadlinePeriodOffset)`; день зажат длиной итогового месяца |
| `computeRecurringTaskDeadline` (shop) | `period: Period`, `deadlineTemplate: string`, `deadlinePeriodOffset: number` | `Date` | То же, зеркало service |
| `DeadlinePeriodOffset.create` | `value: number` | `DeadlinePeriodOffset` | Валидирует `0 <= value <= 3`, целое; бросает `ArgumentInvalidException` иначе |

---

## Frontend — UI Model

### Pages

Не затронуты — изменение целиком внутри существующей фичи `SalaryRuleForm`, отдельной страницы нет.

### Features

| Feature | Статус | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `SalaryRuleForm` | existing, модифицируется | без изменений (`SalaryRuleForm`) | `ruleDraft.ts` (добавляется поле `deadlinePeriodOffset`), `service/model/ruleFormSchema.ts` и `shop/model/ruleFormSchema.ts` (валидация `0..3`) | Форма создания/редактирования зарплатного правила |

### UI-компоненты

| Component | Слой | Props (основные) | Назначение |
|---|---|---|---|
| `TaskCompletionRuleFields` (`features/SalaryRuleForm/ui/RuleFormCard/ui/TaskCompletionRuleFields.tsx`) | features/SalaryRuleForm/ui (существующий, легаси `shared/ui` контролы — не переводится на `ui-kit` в рамках этого изменения) | `draft`, `errors`, `onChange` (без изменений сигнатуры) | Добавляется контрол выбора `deadlinePeriodOffset` (0/1/2/3) рядом с существующим полем даты дедлайна, видим только при `isRecurring: true` |

### Hooks (model)

Не добавляются — `deadlinePeriodOffset` идёт тем же путём, что и существующие поля `draft` (плоский
объект состояния формы, без отдельного хука).

### Паттерны, которые нужно учесть при проектировании

- [ ] Публичный API фичи только через `index.ts` — не меняется, новых экспортов не требуется
- [ ] Запросы к backend — через `model/api.ts` — не затронуто (поле идёт в теле уже существующего запроса создания/обновления правила)
- [ ] Ошибки API нормализуются через `ApiError` — не затронуто
- [ ] `mediator/`-компонент — неприменимо (нет составной страницы)
- [ ] Именованные слоты вместо `children` — неприменимо (точечное добавление контрола в существующую форму)
- [ ] `isInitialLoad`/`isRefreshing` — неприменимо
- [x] Новые компоненты — в `shared/ui-kit/`: контрол выбора смещения — простой `Select`/`SegmentedControl`, переиспользует существующий примитив, которым уже пользуется `TaskCompletionRuleFields.tsx` (легаси `shared/ui`, т.к. сам компонент ещё не мигрирован на `ui-kit` — новый контрол не мигрирует компонент целиком)

---

## Diagrams

Не создавались — см. «Scope» выше (решение пользователя).

---

## Confirmation Checklist

- [ ] Названия entity/aggregate/VO согласованы (`DeadlinePeriodOffset`, отдельная копия на `service`/`shop`)
- [ ] Названия и сигнатуры ключевых методов согласованы (`Period.shiftMonths`, обновлённые сигнатуры `computeDeadlineForPeriod`/`computeRecurringTaskDeadline`)
- [ ] Слои и структура фронта согласованы (точечное изменение существующей `TaskCompletionRuleFields.tsx`, без новых компонентов/хуков)
- [ ] Диаграммы взаимодействия — сознательно опущены (маленькое изменение, подтверждено пользователем)
- [ ] Пользователь подтвердил переход к `ui-design.md`/`tasks.md`
