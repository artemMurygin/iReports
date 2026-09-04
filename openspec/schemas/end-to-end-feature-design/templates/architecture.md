<!--
  Artifact: architecture
  Requires: proposal, design
  Required by: tasks (tasks.md не должен создаваться, пока этот файл не согласован с пользователем)

  Инструкция для агента:
  - Заполняй разделы на основе proposal.md и design.md текущего change.
  - Не придумывай названия "на всякий случай" — только те entity/service/компоненты,
    которые реально нужны для реализации фичи из proposal.md.
  - Для существующих сущностей/модулей (которые уже есть в спеках проекта) помечай
    статус как "existing", для новых — "new".
  - ОБЯЗАТЕЛЬНО: после заполнения всех разделов останови работу и явно спроси
    пользователя подтверждение по разделу "Confirmation Checklist" ниже.
    Не переходи к tasks.md без явного "ок"/"согласен" от пользователя.

  - Диаграммы НЕ рисуются в markdown (mermaid) внутри этого файла.
    Все три диаграммы создаются на Miro-доске через Miro MCP-инструменты
    (например canvas_create_from_svg / diagram-инструменты), после чего в
    файл вставляется только ссылка (board_url или item_url) на созданный
    элемент. Если для этого change ещё нет доски — сначала создай board
    (board_create) в подходящем space проекта, затем создавай диаграммы на ней.

  - Frontend: перед заполнением сверься с frontend/CLAUDE.md (слои FSD, границы
    импортов, паттерны). Не изобретай структуру — переиспользуй существующие
    features/hooks/UI-кит, если подходящие уже есть. Новые UI-компоненты размещай
    только в shared/ui-kit/ (новый дизайн), не в shared/ui/ (легаси).
-->

# Architecture: {change-name}

## Scope
<!-- 1-2 предложения: какую часть системы затрагивает это изменение -->

---

## Backend — Domain Model

### Entities
| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| | | | | |

### Aggregates
| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| | | | |

### Value Objects
| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| | | |

### Services
| Service | Слой (application/domain/infrastructure) | Ответственность |
|---|---|---|
| | | |

### Method Signatures (ключевые, по каждому сервису)
| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| | | | |

---

## Frontend — UI Model

<!--
  Проект использует Feature-Sliced Design (см. frontend/CLAUDE.md): app -> pages ->
  features -> kernel -> shared. Страница не может импортировать другую страницу,
  features не могут кросс-импортировать друг друга, shared ничего не импортирует.
  Внутри pages/<Page> и features/<Feature> — разделение на model/ (стейт, запросы)
  и ui/ (компоненты); публичный API фичи — только export через index.ts.
-->

### Pages
| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| | | | |

### Features (переиспользуемые модули с бизнес-логикой)
| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| | | | | |

### UI-компоненты (page-local и shared)
| Component | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные) | Назначение |
|---|---|---|---|
| | | | |

### Hooks (model)
| Hook | Расположение | Тип (state-хук / query options factory) | Возвращает |
|---|---|---|---|
| | | | |

### Паттерны, которые нужно учесть при проектировании
<!-- Отметь, какие паттерны из frontend/CLAUDE.md применимы к этой фиче -->
- [ ] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента)
- [ ] Запросы к backend — через query options factory в `model/api.ts` (`queryOptions({...})`), не голыми async-функциями
- [ ] Ошибки API нормализуются через `ApiError` (`shared/errors/apiError.ts`) в `.catch()` запроса
- [ ] Для страницы с несколькими stateful-виджетами — `mediator/`-компонент без условного рендера
- [ ] Layout/контейнерные компоненты принимают именованные слоты (`header`/`body`/`footer`), а не `children`
- [ ] Разделение `isInitialLoad` / `isRefreshing` вместо одного `isLoading`, если фильтры не должны "схлопывать" уже отрисованные данные
- [ ] Новые компоненты — в `shared/ui-kit/` (новые токены), не в `shared/ui/` (легаси shadcn)

---

## Diagrams
<!--
  Все диаграммы ниже создаются на Miro-доске через Miro MCP, а не в markdown.
  Порядок действий агента:
  1. Найти/создать board для текущего change (board_search_boards, иначе board_create).
  2. Создать каждую диаграмму на доске (canvas_create_from_svg / соответствующий диаграммный инструмент).
  3. Получить ссылку на доску/элемент и вставить в поле "Miro link" ниже.
  Ссылка должна вести прямо на доску (и, если поддерживается, на конкретный элемент/фрейм).
-->

### 1. Domain Entity Interaction
<!-- Связи между entity/aggregate/VO: композиция, ссылки, кто кем владеет -->
Miro link: `<ссылка на фрейм с диаграммой>`

### 2. External Modules Interaction
<!-- Как этот модуль взаимодействует с другими внутренними модулями и внешними
     системами (например Bitrix24, Miro, MoySklad) — направление вызовов, sync/async -->
Miro link: `<ссылка на фрейм с диаграммой>`

### 3. Layer Interaction — от Controller до Response
<!-- Полный путь запроса через слои: Controller -> Service -> Repository -> DB,
     включая обработку ошибок, если она нетривиальна -->
Miro link: `<ссылка на фрейм с диаграммой>`

---

## Confirmation Checklist
<!-- Агент: выведи этот список пользователю явным текстом перед завершением артефакта -->
- [ ] Названия entity/aggregate/VO согласованы
- [ ] Названия и сигнатуры ключевых методов сервисов согласованы
- [ ] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [ ] Диаграммы взаимодействия отражают ожидаемую реализацию
- [ ] Пользователь подтвердил переход к tasks.md