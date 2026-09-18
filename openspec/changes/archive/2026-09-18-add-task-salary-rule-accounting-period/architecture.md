# Architecture: add-task-salary-rule-accounting-period

## Scope

Изменение затрагивает существующий тип зарплатного правила `TaskCompletion` в доменах `service` и
`shop` (модуль `modules/accounting`) — добавляет явное поле `accountingPeriod` в его конфигурацию,
без новых агрегатов/сущностей. На фронтенде — существующая фича `SalaryRuleForm` (карточка правила
`TaskCompletion`).

---

## Backend — Domain Model

### Entities

| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `TaskCompletion` (`domains/service/modules/accounting`) | existing, modified | нет (часть `MotivationSchema`) | `config.accountingPeriod` (новое), `config.taskIdByPeriod`, `config.isRecurring`, `config.defaultAmount` | Правило «за выполнение задачи» направления `service` |
| `TaskCompletion` (`domains/shop/modules/accounting`) | existing, modified | нет | то же самое, зеркально | Правило «за выполнение задачи» направления `shop` |
| `MotivationSchema` (оба домена) | existing, не изменяется | да | `rules: SalaryRule[]` | Мотивационная схема сотрудника/отдела, владеет набором правил |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `MotivationSchema` (`service`) | `MotivationSchema` | `SalaryRule[]` (включая `TaskCompletion`) | `TaskCompletion.config.accountingPeriod` SHALL быть валидным периодом (`Period`, `YYYY-MM`) и SHALL совпадать с ключом, под которым записан `taskId` в `taskIdByPeriod` в момент создания/автосоздания задачи |
| `MotivationSchema` (`shop`) | `MotivationSchema` | `SalaryRule[]` | то же самое, зеркально |

### Value Objects

| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `Period` (`src/shared/domain/period.value-object.ts`) | значение `YYYY-MM` | Существующий VO, переиспользуется без изменений для валидации формата `accountingPeriod` на границе домена (`buildTaskCompletionConfig`, `EnsureRuleTaskForPeriodService.ensure`) — сам `accountingPeriod` в `TaskCompletionSalaryConfig` остаётся примитивом `string`, так как `config` — плоский JSON-литерал, персистируемый как есть в Prisma `Json`-колонке (тот же приём, что уже применён к `taskIdByPeriod`/`deadlineTemplate`); `Period` используется как валидатор/парсер в момент присвоения, не как тип самого поля |

### Services

| Service | Слой (application/domain/infrastructure) | Ответственность |
|---|---|---|
| `buildTaskCompletionConfig` (`domains/service/.../task-completion.entity.ts`) | domain (функция-фабрика) | Собирает `TaskCompletionSalaryConfig` из запроса — modified: берёт `accountingPeriod` из `request.accountingPeriod` вместо `Period.current()` |
| `TaskCompletion` (shop-аналог `task-completion.entity.ts`) | domain | То же самое, зеркально |
| `EnsureRuleTaskForPeriodService` (`domains/service/.../ensure-rule-task-for-period.service.ts`) | application | Идемпотентное автосоздание задачи регулярного правила на новый период — modified: дополнительно записывает `config.accountingPeriod = period` при создании новой задачи |
| `EnsureShopSalaryTaskForPeriodService` (`domains/shop/.../ensure-salary-task-for-period.service.ts`) | application | То же самое для `shop` — modified, тот же принцип |
| `SalaryRuleMapper.toDomain` (`domains/service/.../salary-rule.repository.ts`, и shop-аналог) | infrastructure | Парсит `SalaryRule.props` (JSON) в доменный `SalaryRule` — modified: при отсутствии `accountingPeriod` в уже персистированных данных дериви́рует его из максимального ключа `taskIdByPeriod` (fallback — `Period.current()`, если карта пуста) |
| `TaskCompletionAutoCreationCron` (`domains/service/.../task-completion-auto-creation.cron.ts`) | infrastructure | Крон, ежемесячно вызывающий `EnsureRuleTaskForPeriodService.ensure()` — не изменяется (уже передаёт `period` явным параметром) |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `buildTaskCompletionConfig` | `request: TaskCompletionSalaryConfigRequest`, `existingTaskIdByPeriod?: Record<string,string>` | `TaskCompletionSalaryConfig` | Сигнатура не меняется; `request.accountingPeriod` — новое обязательное поле входного типа |
| `EnsureRuleTaskForPeriodService.ensure` / `EnsureShopSalaryTaskForPeriodService.ensure` | `rule: SalaryRule`, `period: string`, `assigneeEmployeeId: number` | `Promise<string \| null>` | Сигнатура не меняется; поведение — дополнительно мутирует `config.accountingPeriod` перед `ruleRepo.update(rule)` |
| `SalaryRuleMapper.toDomain` | `row: PersistedSalaryRuleRow` (существующий тип) | `SalaryRule` | Сигнатура не меняется; добавляется деривация `accountingPeriod`, если отсутствует в `props` |

---

## Frontend — UI Model

### Pages

| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| `pages/SalaryRules` (service/shop) | `/salary-rules` (создание схемы) | не изменяется | Использует `SalaryRuleForm` как есть — новое поле рендерится внутри фичи |
| `pages/SalaryRuleDetail` | `/salary-rules/:id` (редактирование схемы) | не изменяется | То же самое |

### Features (переиспользуемые модули с бизнес-логикой)

| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `features/SalaryRuleForm` | existing, modified | без изменений (реэкспорт корневого компонента формы) | `model/ruleDraft.ts` (+ поле `accountingPeriod`), `service/model/ruleFormSchema.ts` и `shop/model/ruleFormSchema.ts` (резолверы, + маппинг `accountingPeriod` в контракт) | Форма создания/редактирования зарплатного правила |

### UI-компоненты (page-local и shared)

| Component | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные) | Назначение |
|---|---|---|---|
| `TaskCompletionRuleFields` (`features/SalaryRuleForm/ui/RuleFormCard/ui/`) | features/SalaryRuleForm/ui | `draft: RuleDraft`, `errors`, `onChange` | modified: добавляется блок выбора периода (`PeriodPicker`) над/рядом с блоком «Задача», видим всегда (не только при `isRecurring`) |
| `PeriodPicker` (`shared/ui-kit/organisms/PeriodPicker.tsx`) | shared/ui-kit | `period: string`, `onChange: (period: string) => void`, `maxPeriod?: string` | existing, без изменений — переиспользуется как есть |

### Hooks (model)

Новых хуков не требуется — `accountingPeriod` читается/пишется как обычное поле плоского объекта
`RuleDraft` через уже существующий `onChange`-паттерн `TaskCompletionRuleFields`.

### Паттерны, которые нужно учесть при проектировании

- [x] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента) — не меняется
- [ ] Запросы к backend — через query options factory в `model/api.ts` — не применимо, новое поле не вводит нового запроса
- [ ] Ошибки API нормализуются через `ApiError` — не применимо
- [ ] Для страницы с несколькими stateful-виджетами — `mediator/`-компонент без условного рендера — не затрагивается
- [ ] Layout/контейнерные компоненты принимают именованные слоты — не затрагивается
- [ ] Разделение `isInitialLoad` / `isRefreshing` — не применимо
- [x] Новые компоненты — в `shared/ui-kit/` — соблюдено: переиспользуется существующий `PeriodPicker` из `shared/ui-kit/organisms`, новых компонентов не создаётся

---

## Diagrams

Пропущено по решению пользователя (небольшая фича — одно новое поле в существующей конфигурации
правила, без новых агрегатов/межмодульных взаимодействий сверх уже описанных в design.md).

---

## Confirmation Checklist

- [x] Названия entity/aggregate/VO согласованы
- [x] Названия и сигнатуры ключевых методов сервисов согласованы
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [x] Диаграммы взаимодействия — пропущены по явному решению пользователя
- [ ] Пользователь подтвердил переход к tasks.md
