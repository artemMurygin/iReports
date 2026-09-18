# Architecture: split-task-completion-rule-form

## Scope

Меняется только флоу создания правила «за выполнение задачи»: форма фичи `SalaryRuleForm`
(разделение на «разовая»/«регулярная» задача), контракт создания правила в `ireports-contracts`, и
бэкенд-обработчик создания правила в доменах `service` и `shop` (вызывает существующий сервис
автосоздания задачи вместо ожидания готового `taskId`). Остальные возможности правила «за выполнение
задачи» (отчёт, дедлайн-смещение, деактивация разового правила) не затрагиваются.

---

## Backend — Domain Model

### Entities
| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `TaskCompletion` (service) | existing, modified | нет (`Entity<TaskCompletionSalaryRule>`, персистируется отдельно от `MotivationSchema` через свой репозиторий) | `name`, `type: 'TaskCompletion'`, `targetRole`, `config: TaskCompletionSalaryConfig`, `isActive` | Правило «за выполнение задачи»; `validate()` получает новый инвариант — ровно один источник задачи (см. VO ниже) |
| `TaskCompletionShop` | existing, modified | нет | те же поля, независимая копия | Зеркало `TaskCompletion` для домена `shop` |
| `MotivationSchema` / `ShopMotivationSchema` | existing, без изменений | да | `name`, `rules[]` | Контекст, в который сохраняется правило (`motivationSchemaId` при `insert`); не меняется этим change |

### Aggregates
| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| Мотивационная схема (не меняется) | `MotivationSchema` / `ShopMotivationSchema` | `TaskCompletion`/`TaskCompletionShop` (персистируются отдельно, связаны по `motivationSchemaId`) | Не в скоупе этого change |

### Value Objects
| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `TaskCompletionTaskSource` (service) | `kind: 'one-off' \| 'recurring'`; для `'one-off'` — `taskId: string`; для `'recurring'` — `taskTitleTemplate`, `taskDescriptionTemplate?`, `deadlineTemplate`, `deadlinePeriodOffset`, `taskLinkTemplates?` | Группа полей с групповой валидацией и одним самостоятельным смыслом — «откуда берётся задача правила»; сегодня это разбросанные примитивы в `TaskCompletionSalaryConfig`, взаимоисключающие по `isRecurring`, но без явной проверки этого инварианта на уровне домена (см. Non-Goals design.md — сейчас контракт различает варианты через discriminated union, но domain-слой этого не делает). Заводится по правилу «группа полей с собственной валидацией/инвариантами → VO» из `backend/CLAUDE.md`. Immutable value object в `domain/value-objects/`, конструируется через `TaskCompletionTaskSource.oneOff(taskId)` / `.recurring({...})` |
| `TaskCompletionTaskSourceShop` | то же, независимая копия | Зеркало для домена `shop` |

### Services
| Service | Слой (application/domain/infrastructure) | Ответственность |
|---|---|---|
| `CreateSalaryRuleHandler` (service) | application (CQRS command handler) | Существующий; модифицируется — после `salaryRuleRepo.insert()` для правил `TaskCompletion` с `source.kind === 'recurring'` вызывает `EnsureRuleTaskForPeriodService.ensure(...)`, чтобы создать первую задачу из шаблона |
| `CreateShopSalaryRuleHandler` | application | Зеркало для `shop` |
| `EnsureRuleTaskForPeriodService` | application | Существующий, без изменений сигнатуры — получает нового вызывающего (см. выше) в дополнение к текущему вызову из `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService` |
| `EnsureShopSalaryTaskForPeriodService` | application | Зеркало, без изменений сигнатуры, новый вызывающий — `CreateShopSalaryRuleHandler` |
| `SalaryRuleFactory` | application/domain (фабрика) | Существующий; сборка `TaskCompletion` из payload — обновляется под `TaskCompletionTaskSource` вместо плоских полей `taskId`/шаблона |

### Method Signatures (ключевые, по каждому сервису)
| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `TaskCompletion.create` | `CreateSalaryRuleProps` (теперь включает `source: TaskCompletionTaskSource` вместо плоских `taskId?`/`taskTitleTemplate?`/…) | `TaskCompletion` | Без изменения сигнатуры верхнего уровня, но `validate()` теперь проверяет ровно один источник задачи через VO |
| `CreateSalaryRuleHandler.execute` | `CreateSalaryRuleCommand` (без изменений сигнатуры) | `Promise<{ id: string }>` | Модифицируется тело: после `insert()` при `source.kind === 'recurring'` — `await this.ensureRuleTaskForPeriodService.ensure(rule, rule.config.accountingPeriod, assigneeEmployeeId)` |
| `EnsureRuleTaskForPeriodService.ensure` | `rule: SalaryRule`, `period: string`, `assigneeEmployeeId: number` | `Promise<string \| null>` | Без изменений — идемпотентно создаёт/возвращает `taskId` задачи периода из шаблона правила |
| `EnsureShopSalaryTaskForPeriodService.ensure` | `salaryRuleId: string`, `period: string`, `assigneeEmployeeId: number` | `Promise<string \| null>` | Без изменений |

---

## Frontend — UI Model

### Pages
| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| `SalaryRulesCreate` | страница создания правил (`pages/SalaryRules/mediator/SalaryRulesCreate.tsx`) | mediator, рендерит `RuleList` из `SalaryRuleForm` | Не меняется — использует обновлённую фичу через тот же публичный API |
| `SalaryRuleDetail` (`ServiceSchemaEditForm`/`ShopSchemaEditForm`) | страница редактирования схемы | ui, использует `RuleFormCard` из `SalaryRuleForm` | Не меняется — тот же паттерн |

### Features (переиспользуемые модули с бизнес-логикой)
| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `SalaryRuleForm` | existing, modified | `RuleFormCard`, `TaskCompletionRuleFields` (реэкспорт не меняется) | `resolveRuleDraft`/`resolveShopRuleDraft` — убирают безусловное требование `taskId`, требуют его только при выборе «разовая задача» | Форма создания/редактирования зарплатных правил; меняется только внутренности `TaskCompletionRuleFields` и схема резолва |
| `CreateTask` | existing, без изменений | `CreateTaskPanel`, `CreateTaskForm`, `useCreateTask` | — | Переиспользуется как есть для сценария «разовая задача» |

### UI-компоненты (page-local и shared)
| Component | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные) | Назначение |
|---|---|---|---|
| `TaskCompletionRuleFields` | `features/SalaryRuleForm/ui/RuleFormCard/ui/` | `draft`, `onChange`, `onCreateTask`, `accountingPeriod`-контекст | existing, modified — вместо одного дерева с условным блоком рендерит режим-переключатель + один из двух подкомпонентов ниже |
| `TaskCompletionModeSwitch` | `features/SalaryRuleForm/ui/RuleFormCard/ui/` (page-local для фичи) | `mode: 'one-off' \| 'recurring'`, `onChange` | new — переключатель режима, теперь первый элемент блока правила (перенос текущего `SegmentedControl`) |
| `OneOffTaskCompletionFields` | `features/SalaryRuleForm/ui/RuleFormCard/ui/` | `draft`, `onChange`, `onCreateTask` | new — задача (кнопка создания, как сейчас), `PeriodPicker`, поле суммы начисления рядом |
| `RecurringTaskCompletionFields` | `features/SalaryRuleForm/ui/RuleFormCard/ui/` | `draft`, `onChange` | new — только шаблон (название, дедлайн+смещение, описание, ссылки) и `PeriodPicker` первого периода; без кнопки создания задачи |

### Hooks (model)
| Hook | Расположение | Тип (state-хук / query options factory) | Возвращает |
|---|---|---|---|
| `resolveRuleDraft` / `resolveShopRuleDraft` | `features/SalaryRuleForm/service(shop)/model/ruleFormSchema.ts` | pure-функция резолва драфта в payload | existing, modified — `taskId` обязателен только при `mode === 'one-off'` |

### Паттерны, которые нужно учесть при проектировании
- [x] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента) — новые подкомпоненты не экспортируются наружу фичи, остаются внутренними для `RuleFormCard`
- [x] Запросы к backend — через query options factory в `model/api.ts` — не меняется, создание задачи по-прежнему идёт через существующий `CreateTask`-флоу
- [x] Ошибки API нормализуются через `ApiError` — не меняется
- [ ] Хуки в model/ инкапсулируют одну зону ответственности — режим-переключатель это чистый UI-стейт (`draft.isRecurring`), отдельного хука не требует
- [ ] Layout/контейнерные компоненты принимают именованные слоты — не применимо, блок правила не layout-контейнер
- [ ] `isInitialLoad`/`isRefreshing` — не применимо, форма не содержит серверных списков с фоновым рефетчем
- [x] Новые компоненты — в `features/SalaryRuleForm/ui/RuleFormCard/ui/` (page-local для фичи, не отдельный `shared/ui-kit`-примитив — переключатель и группировки специфичны для этой формы)

---

## Diagrams

### 1. Domain Entity Interaction
`MotivationSchema`/`ShopMotivationSchema` (не меняется) ← ссылается по `motivationSchemaId` → `TaskCompletion`/`TaskCompletionShop`
(модифицируется) → владеет одним `TaskCompletionTaskSource`/`TaskCompletionTaskSourceShop` (новый VO,
variant `one-off` с `taskId` либо `recurring` с шаблоном) → `taskId` (`one-off`, либо после автосоздания
`recurring`) ссылается на `Task` во внешнем модуле `tasks` (по id, без прямого импорта — см. диаграмму 2).

Miro link: `<будет добавлено после согласования архитектуры>`

### 2. External Modules Interaction
`accounting` (service/shop) → `tasks`: `CreateSalaryRuleHandler`/`CreateShopSalaryRuleHandler` (новый
путь, только для `recurring`) и уже существующий вызов из `GetEmployeeSalaryReportService`/
`GetDepartmentSalaryReportService` — оба идут через `EnsureRuleTaskForPeriodService`/
`EnsureShopSalaryTaskForPeriodService`, которые диспатчат `CreateTaskCommand`/`AddTaskLinkCommand` в
`tasks` через `CommandBus` (единственная межмодульная связь, без прямого импорта репозитория `tasks`).
Frontend: `SalaryRuleForm` → `CreateTask` (`CreateTaskPanel`) → `POST /v1/tasks` — без изменений, только
для сценария «разовая задача».

Miro link: `<будет добавлено после согласования архитектуры>`

### 3. Layer Interaction — от Controller до Response
HTTP-контроллер `salary-rule` → `CommandBus.execute(CreateSalaryRuleCommand)` → `CreateSalaryRuleHandler`
→ `SalaryRuleFactory.create()` (строит `TaskCompletion` с `TaskCompletionTaskSource`, `validate()`
проверяет инвариант источника) → `SalaryRuleRepositoryPort.insert()` (Prisma) → **если** `source.kind
=== 'recurring'` — `EnsureRuleTaskForPeriodService.ensure()` → `CommandBus.execute(CreateTaskCommand)` в
модуле `tasks` → ответ `{ id }`. Ошибки валидации (`TaskCompletionRequiresPersonalSchemaException` и
новое исключение при нарушении инварианта источника задачи) — через `DomainExceptionFilter`.

Miro link: `<будет добавлено после согласования архитектуры>`

---

## Confirmation Checklist
- [ ] Названия entity/aggregate/VO согласованы (в т.ч. новый `TaskCompletionTaskSource`/`TaskCompletionTaskSourceShop`)
- [ ] Названия и сигнатуры ключевых методов сервисов согласованы (`CreateSalaryRuleHandler` теперь вызывает `EnsureRuleTaskForPeriodService`)
- [ ] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы (новые `TaskCompletionModeSwitch`/`OneOffTaskCompletionFields`/`RecurringTaskCompletionFields` — page-local внутри `SalaryRuleForm`)
- [ ] Диаграммы взаимодействия отражают ожидаемую реализацию
- [ ] Пользователь подтвердил переход к tasks.md
