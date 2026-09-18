# Architecture: delete-task-frontend

## Scope

Только frontend: новая кнопка удаления и confirm-диалог внутри карточки задачи (`features/TaskStatusControl`), использующие уже существующий backend-эндпоинт `DELETE /v1/tasks/:id`. Новых backend-сущностей, доменных изменений или изменений контрактов нет.

> **Отклонение от шаблона схемы**: по решению пользователя три диаграммы взаимодействия не создаются на Miro-доске (обычно требуется этой схемой) — фича ограничена фронтендом, новых доменных сущностей или межслойных взаимодействий, которые оправдывали бы отдельную доску, нет. Взаимодействие полностью описано текстом ниже и в design.md.

---

## Backend — Domain Model

Backend не меняется. Существующие сущности, участвующие в потоке (для контекста, не переиспользуются как часть этого изменения):

### Entities
| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `Task` | existing | да | `id`, `title`, `status`, ... | Удаляется целиком через уже существующий `DeleteTaskCommand`/`TaskRepositoryPort.delete()` |

### Aggregates
_Изменений нет — используется существующий агрегат `Task` без модификаций._

### Value Objects
_Изменений нет._

### Services
| Service | Слой | Ответственность |
|---|---|---|
| `DeleteTaskHandler` | application (existing) | Уже реализован — обрабатывает `DeleteTaskCommand`, вызывается через существующий `DELETE /v1/tasks/:id` |

### Method Signatures
_Новых методов на backend нет — переиспользуется существующий `TaskRepositoryPort.delete(id): Promise<void>`._

---

## Frontend — UI Model

### Pages
| Page | Route | Структура | Назначение |
|---|---|---|---|
| `pages/Tasks` | (existing route) | existing, без изменений | Список задач — обновится автоматически за счёт инвалидации `TASKS_QUERY_KEY_PREFIX` после удаления |

### Features (переиспользуемые модули с бизнес-логикой)
| Feature | Статус | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `features/TaskStatusControl` | existing, modified | без изменений (`TaskDetailsPanel` как корневой компонент) | + `useDeleteTask`, + `useDeleteTaskDialog`, + `tasksApi.remove` | Добавляется удаление задачи из карточки деталей |

### UI-компоненты (page-local и shared)
| Component | Слой | Props (основные) | Назначение |
|---|---|---|---|
| `TaskStatusCard` | `features/TaskStatusControl/ui` (existing, modified) | без изменений | + `IconButton` «Удалить» (`Trash2`, `variant="danger"`) в заголовке карточки, рядом с «Редактировать»/«Закрыть» |
| `DeleteTaskDialog` | `features/TaskStatusControl/ui` (new) | `isOpen`, `taskTitle`, `isPending`, `error`, `onConfirm`, `onCancel` | Confirm-модалка удаления (`Modal`), по образцу `DeleteRuleTaskDialog` |
| `TaskDetailsPanel` | `features/TaskStatusControl/ui` (existing, modified) | без изменений | При успешном удалении вызывает `onClose()` |

### Hooks (model)
| Hook | Расположение | Тип | Возвращает |
|---|---|---|---|
| `useDeleteTask` | `features/TaskStatusControl/model` (new) | мутация (`useMutation`) | `{ mutate, isPending, error }` — вызывает `tasksApi.remove`, на успехе инвалидирует `TASKS_QUERY_KEY_PREFIX` |
| `useDeleteTaskDialog` | `features/TaskStatusControl/model` (new) | state-хук (confirm-раннер, по образцу `useDeleteRuleTask`) | `{ isOpen, open, close, confirm, isPending, error }` |

### Паттерны, которые нужно учесть при проектировании
- [x] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента) — новые файлы не экспортируются напрямую наружу фичи
- [ ] Запросы к backend через `queryOptions({...})` в `model/api.ts` — не применимо: `tasksApi.remove` это мутация (DELETE без тела), оформляется как обычный async-метод в `tasksApi`, по образцу уже существующего `tasksApi.update`
- [x] Ошибки API нормализуются через `ApiError`/`extractApiErrorMessage`, показываются в `DeleteTaskDialog`
- [ ] Mediator-компонент — не требуется: единственный новый stateful-виджет (`DeleteTaskDialog`) управляется одним хуком (`useDeleteTaskDialog`), композиция происходит в `TaskStatusCard`/`TaskDetailsPanel`, не на уровне страницы
- [ ] Именованные слоты layout — не применимо, `DeleteTaskDialog` использует готовый `Modal` с `footer`-слотом как есть
- [ ] `isInitialLoad`/`isRefreshing` — не применимо, удаление разовое действие, не список с фильтрами
- [x] Новый компонент (`DeleteTaskDialog`) — в `features/TaskStatusControl/ui`, использует примитивы `shared/ui-kit/` (`Modal`, `Button`, `IconButton`), не `shared/ui/` legacy

---

## Diagrams

Диаграммы на Miro не создавались — см. отклонение от шаблона в разделе Scope. Взаимодействие:

**Поток удаления**: пользователь нажимает `Trash2` в `TaskStatusCard` → `useDeleteTaskDialog.open()` показывает `DeleteTaskDialog` → пользователь подтверждает → `useDeleteTaskDialog.confirm()` вызывает `useDeleteTask.mutate(taskId)` → `tasksApi.remove(taskId)` → `DELETE /v1/tasks/:id` (существующий контроллер → `DeleteTaskHandler` → `TaskRepositoryPort.delete()`, каскадно чистит `TaskComment`/`TaskLink`) → `204 No Content` → `onSuccess`: инвалидация `TASKS_QUERY_KEY_PREFIX` + `TaskDetailsPanel.onClose()` → панель закрывается, список задач на `pages/Tasks` перезапрашивается и больше не содержит удалённую задачу.

---

## Confirmation Checklist
- [x] Названия entity/aggregate/VO согласованы — backend не меняется, новых entity нет
- [x] Названия и сигнатуры ключевых методов согласованы (`tasksApi.remove`, `useDeleteTask`, `useDeleteTaskDialog`, `DeleteTaskDialog`)
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [x] Диаграммы взаимодействия — заменены текстовым описанием потока по решению пользователя (см. Scope)
- [x] Пользователь подтвердил переход к tasks.md
