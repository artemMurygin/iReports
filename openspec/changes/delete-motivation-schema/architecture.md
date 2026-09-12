# Architecture: delete-motivation-schema

## Scope

Удаление мотивационной схемы целиком (со своими правилами) со страницы редактирования схемы, для
направлений `service` и `shop` независимо. Затрагивает модуль `accounting` обоих доменов
(domain/application/infrastructure/interface) и страницу `SalaryRuleDetail` фронтенда.

_Диаграммы на Miro пропущены по решению пользователя — масштаб фичи (один новый CQRS use case на
направление + один диалог подтверждения) не оправдывает создание доски; ниже — эквивалентные
текстовые таблицы._

---

## Backend — Domain Model

### Entities

| Name              | Status (new/existing) | Aggregate root? | Ключевые поля                          | Назначение                                                                 |
| ----------------- | ---------------------- | ---------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `MotivationSchema` (service) | existing | да | `id`, `target` (VO), `name`, `rules`    | Уже есть `create()`/`rename()`; новых методов на самой сущности не требуется — удаление своей стороны общей строки решается на уровне репозитория (см. design.md, Decision 1), а не мутацией агрегата. |
| `MotivationSchema` (shop)    | existing | да | зеркально service                       | Симметрично service.                                                       |

### Aggregates

| Aggregate                 | Root entity      | Входит в состав (entities/VO) | Инварианты, которые защищает                                                    |
| -------------------------- | ----------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| MotivationSchema (service) | MotivationSchema  | `MotivationTarget` (VO), `rules: SalaryRule[]` (только своего direction) | Схема без правил своего направления не существует для этого домена (см. `findById`/`GetMotivationSchemaService`). |
| MotivationSchema (shop)    | MotivationSchema  | зеркально service               | Симметрично.                                                                        |

### Value Objects

Изменений нет — используются существующие `MotivationTarget` (service) и его shop-аналог.

### Services

| Service                              | Слой (application/domain/infrastructure) | Ответственность                                                                                                                          |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DeleteMotivationSchemaHandler` (service) | application (CQRS `ICommandHandler`)        | new. Находит схему по id (переиспользует `findById`, тот же 404-критерий "0 правил своего направления", что и `GetMotivationSchemaService`), вызывает удаление в репозитории. |
| `DeleteMotivationSchemaHandler` (shop)    | application                                  | new. Зеркально service, свой independent класс.                                                                                              |
| `MotivationSchemaRepository.deleteDirectionSchema` (service) | infrastructure                | new метод на существующем классе. Удаляет правила своего direction; удаляет родительскую строку, если у неё не осталось правил другого direction; иначе — очищает `serviceName`. Всё внутри `write()` (см. design.md, Decision 1). |
| `MotivationSchemaRepository.deleteDirectionSchema` (shop)    | infrastructure                | new. Зеркально, чистит `shopName`.                                                                                                            |
| `DeleteMotivationSchemaHttpController` (service) | interface                              | new. `DELETE` на существующий `routesV1.service.motivationSchema.byId`, `@HttpCode(204)`.                                                    |
| `DeleteMotivationSchemaHttpController` (shop)    | interface                              | new. `DELETE` на существующий `routesV1.shop.accounting.motivationSchema.byId`.                                                               |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method                                          | Params                                              | Returns          | Краткое описание                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `DeleteMotivationSchemaHandler.execute`                    | `DeleteMotivationSchemaCommand { schemaId: string }` | `Promise<void>`     | `findById` → если нет схемы/0 правил своего direction — `NotFoundException`; иначе `repo.deleteDirectionSchema(id)`. |
| `MotivationSchemaRepositoryPort.deleteDirectionSchema`     | `id: string`                                        | `Promise<void>`     | Новый метод порта (у каждого домена — свой порт/своя реализация, direction фиксирован внутри реализации). |
| `DeleteMotivationSchemaHttpController.delete`              | `@Param('id') id: string`                            | `Promise<void>`     | `commandBus.execute(new DeleteMotivationSchemaCommand({ schemaId: id }))`.                                |

---

## Frontend — UI Model

### Pages

| Page                                  | Route                                              | Структура (ui / +model / +mediator)                                                  | Назначение                                                             |
| ---------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `SalaryRuleDetail/service`               | `/salary-rules/service/:id` (существующий, см. `router.tsx`) | +ui: новая кнопка "Удалить схему" и `DeleteMotivationSchemaDialog` в `ServiceSchemaEditForm.tsx`/`useServiceSchemaEditPage.ts`; +model: новый хук `useDeleteMotivationSchema.ts` | Экран редактирования схемы получает возможность удалить её целиком.        |
| `SalaryRuleDetail/shop`                  | `/salary-rules/shop/:id`                                | зеркально service                                                                          | Симметрично.                                                                |

Новых страниц/маршрутов не добавляется — после удаления `navigate()` на уже существующий маршрут
списка (`SalaryRuleList`).

### Features (переиспользуемые модули с бизнес-логикой)

Отдельной переиспользуемой feature не заводится — паттерн (диалог удаления + мутация) уже page-local
в проекте (`DeletePayoutDialog` живёт в `features/EmployeeBalance`, `DeleteIdentityModal` — в
`pages/EmployeeIdentity`), и здесь используется по тому же прецеденту: `DeleteMotivationSchemaDialog`
— page-local компонент внутри `pages/SalaryRuleDetail/{service,shop}/ui/`, не отдельная feature.

### UI-компоненты (page-local и shared)

| Component                       | Слой (pages/<Page>/ui · shared/ui-kit · shared/ui legacy) | Props (основные)                                              | Назначение                                                                 |
| ---------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `DeleteMotivationSchemaDialog` (service) | `pages/SalaryRuleDetail/service/ui/`                          | `open`, `onOpenChange`, `schemaName`, `onConfirm`, `isPending`, `error` | new. Модалка подтверждения на `shared/ui-kit/organisms/Modal`, по образцу `DeletePayoutDialog`/`DeleteIdentityModal` (danger-кнопка, инлайн-ошибка `bg-danger-soft`). |
| `DeleteMotivationSchemaDialog` (shop)    | `pages/SalaryRuleDetail/shop/ui/`                              | зеркально                                                           | Симметрично, независимая копия (без общего кода между `service`/`shop`, см. `frontend/CLAUDE.md`). |
| Кнопка "Удалить схему"                   | внутри `ServiceSchemaEditForm.tsx` / shop-аналога              | `onClick` → открывает диалог                                       | `Button variant="danger"` (или `IconButton variant="danger"` с `Trash2`, по образцу `RoleCard.tsx`) в шапке/футере формы редактирования. |

### Hooks (model)

| Hook                                 | Расположение                                              | Тип (state-хук / query options factory) | Возвращает                                                                 |
| ---------------------------------------| ---------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `useDeleteMotivationSchema` (service)  | `pages/SalaryRuleDetail/service/model/useDeleteMotivationSchema.ts` | state-хук (`useMutation` поверх `api.deleteMotivationSchema`) | `{ deleteSchema, isPending, error }`; `onSuccess` — инвалидация `['salary-rule-list']` + `navigate` на список. |
| `useDeleteMotivationSchema` (shop)     | `pages/SalaryRuleDetail/shop/model/useDeleteMotivationSchema.ts` | зеркально                                    | Симметрично.                                                                |
| `api.deleteMotivationSchema` (добавляется в существующий `model/api.ts` каждой страницы) | `pages/SalaryRuleDetail/{service,shop}/model/api.ts` | query options factory (`mutationFn`, без `queryOptions` — DELETE не кешируется) | `(id: string) => Promise<void>`, оборачивает сетевую ошибку в `ApiError`. |

### Паттерны, которые нужно учесть при проектировании

- [x] Публичный API фичи только через `index.ts` — не применимо, компонент page-local (не отдельная feature).
- [x] Запросы к backend — через `model/api.ts`, метод мутации возвращает `Promise<void>`, используется в `useMutation({ mutationFn })` (DELETE не кешируется через `queryOptions`, это штатно для мутаций в проекте — см. `useUpdateMotivationSchema`).
- [x] Ошибки API нормализуются через `ApiError` в `.catch()` запроса.
- [ ] Mediator-компонент без условного рендера — не требуется, страница уже использует свой `useServiceSchemaEditPage.ts`/`useServiceSchemaEditForm.ts`, диалог подключается туда же, без ветвления в самом mediator (видимость диалога — через `open` проп, не через условный JSX внутри mediator).
- [ ] Именованные слоты layout — не применимо, диалог не контейнерный layout-компонент.
- [ ] `isInitialLoad`/`isRefreshing` — не применимо, удаление не запрос на чтение.
- [x] Новый компонент — в `shared/ui-kit`-паттерне (`Modal` из `shared/ui-kit/organisms`), не `shared/ui` legacy.

---

## Diagrams

Пропущены по решению пользователя (см. Scope) — обмен между слоями исчерпывающе описан таблицами
Method Signatures (backend) и Hooks/Components (frontend) выше; путь запроса тривиален
(`Controller → CommandBus → Handler → Repository.deleteDirectionSchema → Prisma transaction`),
дополнительная диаграмма не добавляет информации.

---

## Confirmation Checklist

- [x] Названия entity/aggregate/VO согласованы (новых entity/VO не вводится, только новый метод порта/репозитория)
- [x] Названия и сигнатуры ключевых методов сервисов согласованы (см. таблицу Method Signatures)
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [x] Диаграммы взаимодействия — пропущены по явному решению пользователя, заменены таблицами
- [x] Пользователь подтвердил переход к tasks.md (упрощённый architecture.md без Miro — выбор пользователя в предыдущем шаге)
