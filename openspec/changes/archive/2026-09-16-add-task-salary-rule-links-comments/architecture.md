# Architecture: add-task-salary-rule-links-comments

## Scope

Расширяет карточку задачи (`modules/tasks`) собственными комментариями и ссылками, и добавляет
read-only отображение связанного зарплатного правила/начисления с боковой панелью правила — без
нарушения существующей изоляции `modules/tasks` ↔ `domains/{service,shop}/modules/accounting`.

---

## Backend — Domain Model

### Entities
| Name | Status | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `Task` | existing, не меняется | yes | `id, direction?, title, description?, deadline, assigneeEmployeeId, status, closedSuccessfullyAt?` | уже существует; в этом change не получает ни новых полей, ни знания о правиле |
| `TaskComment` | new | yes | `id, taskId, authorEmployeeId, body: TaskCommentBody, createdAt` | комментарий к задаче (`tasks/comments`) |
| `TaskLink` | new | yes | `id, taskId, url: TaskLinkUrl, label?, createdAt` | ссылка на задаче (`tasks/links`) |
| `SalaryRule` | existing, не меняется | yes | (без изменений) | источник данных для панели правила, чтение через уже существующий порт |

### Aggregates
| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| Task | `Task` | `TaskStatus` (VO) | переходы статуса (`tasks#Requirement: Жизненный цикл статуса задачи`) — не меняется |
| TaskComment | `TaskComment` | `TaskCommentBody` (VO) | текст не пустой (`tasks/comments#Requirement: Пустой комментарий отклоняется`) |
| TaskLink | `TaskLink` | `TaskLinkUrl` (VO) | адрес синтаксически валиден (`tasks/links#Requirement: Ссылка должна быть валидным адресом`) |

### Value Objects
| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `TaskCommentBody` | `text: string` | самовалидация: не пустой и не только пробелы при конструировании |
| `TaskLinkUrl` | `value: string` | самовалидация: синтаксически корректный URL при конструировании |

### Services
| Service | Слой | Ответственность |
|---|---|---|
| `AddTaskCommentService` | application (CQRS command handler `AddTaskCommentCommand`) | создаёт `TaskComment` (автор — `req.user.employeeId`, не из тела запроса), сохраняет |
| `ListTaskCommentsService` | application (query) | отдаёт комментарии задачи в хронологическом порядке |
| `AddTaskLinkService` | application (CQRS command handler `AddTaskLinkCommand`) | создаёт `TaskLink`, сохраняет |
| `RemoveTaskLinkService` | application (CQRS command handler `RemoveTaskLinkCommand`) | удаляет ссылку задачи |
| `ListTaskLinksService` | application (query) | отдаёт ссылки задачи |
| `TaskCommentRepository` | infrastructure (Prisma) | реализация `TaskCommentRepositoryPort` |
| `TaskLinkRepository` | infrastructure (Prisma) | реализация `TaskLinkRepositoryPort` |
| `FindSalaryRuleForTaskService` ×2 (`service`, `shop`) | application (query) | оркестрирует новый `SalaryRuleRepositoryPort.findByTaskId`, маппит в DTO для панели задачи |
| `FindSalaryAccrualForTaskService` ×2 (`service`, `shop`) | application (query) | оркестрирует новый `SalaryAccrualRepositoryPort.findLineByTaskId` |
| `GetSalaryRuleService` ×2 (`service`, `shop`) | application (query) | тонкая read-обёртка над **уже существующим** `SalaryRuleRepositoryPort.findById` для боковой панели правила |
| `SalaryRuleRepository` ×2 | infrastructure, existing, расширяется | добавляет метод `findByTaskId` рядом с уже существующими `insert/deleteByIds/findById/update` |
| `SalaryAccrualRepository` ×2 | infrastructure, existing, расширяется | добавляет метод `findLineByTaskId` рядом с существующими методами порта |

### Method Signatures (ключевые, по каждому сервису)
| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `TaskCommentRepositoryPort.insert` | `comment: TaskComment` | `Promise<void>` | сохраняет новый комментарий |
| `TaskCommentRepositoryPort.findByTaskId` | `taskId: string` | `Promise<TaskComment[]>` | все комментарии задачи, по времени создания по возрастанию |
| `TaskLinkRepositoryPort.insert` | `link: TaskLink` | `Promise<void>` | сохраняет новую ссылку |
| `TaskLinkRepositoryPort.delete` | `linkId: string` | `Promise<void>` | удаляет ссылку |
| `TaskLinkRepositoryPort.findByTaskId` | `taskId: string` | `Promise<TaskLink[]>` | все ссылки задачи |
| `AddTaskCommentService.execute` | `{ taskId, authorEmployeeId, text }` | `Promise<TaskComment>` | валидирует текст через `TaskCommentBody`, создаёт и сохраняет |
| `AddTaskLinkService.execute` | `{ taskId, url, label? }` | `Promise<TaskLink>` | валидирует адрес через `TaskLinkUrl`, создаёт и сохраняет |
| `RemoveTaskLinkService.execute` | `{ taskId, linkId }` | `Promise<void>` | удаляет ссылку, если она принадлежит задаче |
| `SalaryRuleRepositoryPort.findByTaskId` **(new)** | `taskId: string` | `Promise<SalaryRule \| null>` | среди правил вида `TaskCompletion` находит то, чей `props.config.taskIdByPeriod` для текущего периода равен `taskId`; `direction` домена зашит в репозитории, как и у существующих методов порта |
| `SalaryAccrualRepositoryPort.findLineByTaskId` **(new)** | `direction, taskId: string` | `Promise<SalaryAccrualLine \| null>` | ищет строку начисления, чей `sources` содержит `{type: 'taskCompletion', id: taskId}` — `direction` передаётся явно, как и у существующих методов этого порта |
| `FindSalaryRuleForTaskService.execute` | `taskId: string` | `Promise<SalaryRuleSummary \| null>` | правило для блока на карточке задачи (`tasks/salary-rule-panel`) |
| `FindSalaryAccrualForTaskService.execute` | `taskId: string` | `Promise<SalaryAccrualLineSummary \| null>` | начисление для блока на карточке задачи; `SalaryAccrualLineSummary` включает сумму и статус строки (`Проведено`/иное) — уточнено по итогам `ui-design.md` |
| `GetSalaryRuleService.execute` | `ruleId: string` | `Promise<SalaryRuleDetail>` | данные для боковой панели правила (название, вид, роль, направление, параметры, **название мотивационной схемы, к которой относится правило** — уточнено по итогам `ui-design.md`); бросает `SalaryRuleNotFoundException`, если не найдено |

### HTTP-эндпоинты (interface layer)
| Controller | Route | Примечание |
|---|---|---|
| `ListTaskCommentsHttpController` | `GET /v1/tasks/:id/comments` | |
| `CreateTaskCommentHttpController` | `POST /v1/tasks/:id/comments` | автор — из `req.user.employeeId` (`SessionAuthGuard`), не из тела |
| `ListTaskLinksHttpController` | `GET /v1/tasks/:id/links` | |
| `CreateTaskLinkHttpController` | `POST /v1/tasks/:id/links` | |
| `DeleteTaskLinkHttpController` | `DELETE /v1/tasks/:id/links/:linkId` | |
| `GetSalaryRuleHttpController` ×2 | `GET /v1/{service,shop}/accounting/salary-rules/:ruleId` | использует уже существующий `findById` |
| `GetSalaryRuleByTaskHttpController` ×2 | `GET /v1/{service,shop}/accounting/salary-rules/by-task/:taskId` | 404/`null`, если правило не найдено |
| `GetSalaryAccrualLineByTaskHttpController` ×2 | `GET /v1/{service,shop}/accounting/salary-accrual-lines/by-task/:taskId` | 404/`null`, если начисление ещё не отображается |

Все контроллеры — в уже зарегистрированных в `swagger.config.ts` модулях (`TasksModule` в
`commonDocument`, `AccountingModule`/`ShopAccountingModule` в `serviceDocument`/`shopDocument`) —
правки `swagger.config.ts` не требуются, только `@ApiTags`/`@ApiOperation` на новых классах/методах.

### Исключения
| Exception | Код | Где бросается |
|---|---|---|
| `TaskCommentBodyEmptyException` | `TASKS.COMMENT_BODY_EMPTY` | конструктор `TaskCommentBody` |
| `InvalidTaskLinkUrlException` | `TASKS.INVALID_LINK_URL` | конструктор `TaskLinkUrl` |
| `SalaryRuleNotFoundException` | `ACCOUNTING.SALARY_RULE_NOT_FOUND` | `GetSalaryRuleService` |

---

## Frontend — UI Model

### Pages
| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| `pages/Tasks` | `/tasks` | **mediator** (новое: сейчас один stateful-виджет со списком задач в `useTasksPage()`, добавление панели правила делает виджетов два — выделяется `mediator/TasksPageMediator` без собственной бизнес-логики, только композиция `useTasksPage()` + новый `useSalaryRulePanel()`) | список задач, карточка задачи, **новое**: боковая панель зарплатного правила по клику из карточки |
| `pages/SalaryRuleDetail`, `pages/SalaryRules` | без изменений | без изменений | продолжают открывать `TaskDetailsPanel` как раньше; `onOpenSalaryRule` туда не прокидывается (см. Non-Goals в design.md) — блок правила/начисления виден, но не кликабелен |

### Features (переиспользуемые модули с бизнес-логикой)
| Feature | Статус | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `features/TaskStatusControl` | existing, расширяется | `TaskDetailsPanel` (тот же компонент, новый опциональный проп `onOpenSalaryRule?`) | + `useTaskComments`, `useTaskLinks`, `useTaskSalaryReference`; `api.ts` + `commentsApi`, `linksApi`, `salaryReferenceApi` | карточка задачи: статус/переходы (без изменений) + новые блоки комментариев, ссылок, правила/начисления |
| `features/SalaryRuleDetailsPanel` | new | `SalaryRuleDetailsPanel({ ruleId, direction, open, onClose })` | `useSalaryRule(ruleId, direction)`, `api.ts` (`salaryRuleApi.get`) | read-only боковая панель с описанием зарплатного правила |

### UI-компоненты (page-local и shared)
| Component | Слой | Props (основные) | Назначение |
|---|---|---|---|
| `TaskCommentsSection` | `features/TaskStatusControl/ui` | `{ comments, onAddComment, isSubmitting }` | список комментариев + форма добавления |
| `TaskLinksSection` | `features/TaskStatusControl/ui` | `{ links, onAddLink, onRemoveLink }` | список ссылок + добавление/удаление |
| `SalaryRuleSummaryBlock` | `features/TaskStatusControl/ui` | `{ summary, accrual, onOpen? }` | блок правила/начисления на карточке задачи; без `onOpen` — некликабельный |
| `SalaryRuleSummaryCard` | `features/SalaryRuleDetailsPanel/ui` | `{ rule }` | презентационная карточка описания правила внутри панели |

### Hooks (model)
| Hook | Расположение | Тип | Возвращает |
|---|---|---|---|
| `useTaskComments(taskId)` | `features/TaskStatusControl/model` | query options factory + mutation | `{ comments, addComment, isAdding, error }` |
| `useTaskLinks(taskId)` | `features/TaskStatusControl/model` | query options factory + mutation | `{ links, addLink, removeLink, error }` |
| `useTaskSalaryReference(task)` | `features/TaskStatusControl/model` | query options factory | `{ rule, accrual, isLoading }` — направление берёт из `task.direction`, при его отсутствии опрашивает `service`, затем `shop` (design.md, решение 3) |
| `useSalaryRule(ruleId, direction)` | `features/SalaryRuleDetailsPanel/model` | query options factory | `{ rule, isLoading, error }` |
| `useSalaryRulePanel()` | `pages/Tasks/model` (новое, по образцу `useTaskLinkPanels`) | state-хук, без побочных эффектов | `{ openRuleRef, openRule, closeRule }` |

### Паттерны, которые нужно учесть при проектировании
- [x] Публичный API фичи только через `index.ts`
- [x] Запросы к backend — через `queryOptions({...})` в `model/api.ts`
- [x] Ошибки API — через `ApiError`/`extractApiErrorMessage`
- [x] `pages/Tasks` получает `mediator/`-компонент (два stateful-виджета)
- [ ] Именованные слоты layout — не требуется, новых layout-контейнеров нет
- [ ] `isInitialLoad`/`isRefreshing` — не требуется, панели открываются точечно, без фильтров
- [x] Новые компоненты — в `shared/ui-kit/` при переиспользовании (`SidePanel` уже там); page/feature-local компоненты — внутри своих `ui/`

---

## Diagrams

Пропущены по решению пользователя на этапе черновика — диаграммы Miro для этого change не создавались.

### 1. Domain Entity Interaction
Miro link: `TBD`

### 2. External Modules Interaction
Miro link: `TBD`

### 3. Layer Interaction — от Controller до Response
Miro link: `TBD`

---

## Confirmation Checklist
- [x] Названия entity/aggregate/VO согласованы
- [x] Названия и сигнатуры ключевых методов сервисов согласованы
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [x] Диаграммы взаимодействия — пропущены по решению пользователя (см. выше)
- [x] Пользователь подтвердил переход к ui-design.md/tasks.md
