# Architecture: add-bitrix24-auth-and-rbac

## Scope

Два новых сквозных backend-модуля (`auth`, `session`) и модуль `roles` вне
доменов `opt/service/shop`, впервые вводимая в проект инфраструктура Redis, глобальные guard'ы
доступа и соответствующий frontend-слой (защита роутов/меню по permissions, админ-страница
управления ролями). Идентичность пользователя — существующий `BitrixEmployee`, отдельная сущность
`User` не заводится (см. `design.md` Decision 2). Существующая интеграция
`backend/src/integrations/bitrix/**` не затрагивается; `src/sync/bitrix` и `src/modules/directory`
получают точечные, аддитивные расширения (см. ниже).

---

## Backend — Domain Model

### Entities
| Name | Status | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `BitrixEmployee` | existing (переиспользуется как identity) | нет (владеет `src/sync/bitrix`) | `id` (= Bitrix24 user ID), `firstName`, `lastName`, `isActive`, `departmentId` | Единственный источник идентичности — новая `User` НЕ заводится |
| `BitrixEmployeeCredentials` | new | да (1:1 с `BitrixEmployee`) | `bitrixEmployeeId`, `memberId` (+ VO `BitrixCredentials`) | Токены Bitrix24 конкретного сотрудника |
| `Role` | new | да | `id`, `name` (+ коллекция `PermissionCode`) | Именованный набор permissions |
| `Permission` | new | нет (справочник) | `id`, `code` (VO `PermissionCode`), `label`, `group` | Каталог permission-кодов `resource:action`; наполняется сидом из типизированных реестров модулей-владельцев, не создаётся вручную через UI (см. `design.md` Decision 12) |
| `Session` | new | да (backing store — Redis, не Prisma) | `sessionId` (VO), `bitrixEmployeeId`, `permissions`, `issuedAt` | Активная серверная сессия |

### Aggregates
| Aggregate | Root entity | Входит в состав | Инварианты, которые защищает |
|---|---|---|---|
| `BitrixEmployeeCredentials` | `BitrixEmployeeCredentials` | `BitrixCredentials` (VO) | Один `bitrixEmployeeId` → одна запись токенов; `BitrixCredentials` меняются только все три поля сразу |
| `Role` | `Role` | `PermissionCode[]` | Уникальность `name`; каждый код набора — валидный `resource:action` |
| `Session` | `Session` | `permissions: string[]` (снимок) | `sessionId` уникален и криптографически случаен; `permissions` — снимок на момент создания/последнего push, не live-join |

`BitrixEmployee` сам по себе НЕ становится частью этих аггрегатов — новые модули ссылаются на его
`id` как на обычный внешний идентификатор (плоское поле `bitrixEmployeeId`, без VO — это "суррогатный
id без собственной семантики", см. правило VO), не загружая и не владея самой записью.

### Value Objects
| Name | Поля | Почему VO |
|---|---|---|
| `BitrixCredentials` | `accessToken`, `refreshToken`, `expiresAt` | Группа полей, всегда меняющихся вместе (обновление токена трогает все три сразу); инкапсулирует `isExpired()` |
| `PermissionCode` | `value: string` формата `resource:action` | Самовалидирующийся формат, сравнение по значению |
| `SessionId` | `value: string` (≥32 байт энтропии) | Самовалидирующийся формат/длина, сравнение по значению, генерируется заново на каждый логин |

### Services
| Service | Слой / модуль | Ответственность |
|---|---|---|
| `BitrixEmbeddedLoginHandler` | application · `auth` | Валидирует `AUTH_ID` через `user.current`, резолвит `bitrixEmployeeId`, оркестрирует выдачу сессии |
| `BitrixOAuthLoginHandler` | application · `auth` | Обменивает `code` на токены, резолвит `user.current`, оркестрирует выдачу сессии |
| `BitrixIdentityResolver` | domain/application · `auth` | Общий шаг резолва `bitrixEmployeeId` через REST `user.current`, переиспользуется обоими сценариями |
| `BitrixTokenRefreshService` | application · `auth` | Проверяет `expiresAt`, обновляет `access_token` через `refresh_token` перед вызовом Bitrix REST от имени сотрудника |
| `BitrixEmployeeUpsertAdapter` | infrastructure · `src/sync/bitrix` (существующий модуль, точечное расширение) | Реализация `BITRIX_EMPLOYEE_UPSERT_PORT.upsertOne` — извлечена из `uploadEmployees()`, вызывается `auth` при отсутствии `BitrixEmployee` на логине |
| `SessionAuthGuard` | interface · `session`, применяется глобально | Читает `session_id` из cookie/заголовка, валидирует в Redis, наполняет `request.user`, продлевает TTL (fail-closed при недоступности Redis) |
| `SessionService` | application · `session` | Реализация `SESSION_PORT`: создание/валидация/продление/удаление/массовая инвалидация/обновление permissions сессий в Redis |
| `PermissionsResolverAdapter` | infrastructure · `roles` | Реализация `PERMISSIONS_RESOLVER_PORT`: агрегирует `permissionCode` всех ролей сотрудника |
| `PermissionsCatalogSeeder` | infrastructure · `roles`, запускается при деплое (не рантайм-сканирование) | Агрегирует типизированные реестры permission-кодов всех модулей-владельцев (`{code,label,group}`) и делает `upsert` в таблицу `Permission` (`design.md` Decision 12) |
| `RolesCommandHandlers` | application · `roles` | CQRS-хендлеры: CRUD ролей, обновление прав роли (с push через `SESSION_PORT`), назначение/снятие ролей сотруднику |
| `PermissionsGuard` | interface · `roles`, применяется глобально | Сверяет `@RequirePermissions(...)` (через `Reflector`) с `request.user.permissions` |

Список сотрудников для админ-страницы ролей НЕ реализуется отдельным сервисом в `roles` — читается
напрямую через уже существующий `DIRECTORY_REPOSITORY` (`src/modules/directory`), см. `design.md`
Decision 1.

### Method Signatures (ключевые)
| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `BitrixEmbeddedLoginHandler.execute` | `authId, memberId` | `{ sessionId, delivery }` | Валидация + логин по embedded-сценарию |
| `BitrixOAuthLoginHandler.execute` | `code, state` | `{ sessionId, delivery }` | Обмен кода на токены + логин по OAuth-сценарию |
| `BitrixIdentityResolver.resolveBitrixEmployeeId` | `accessToken, clientEndpoint` | `Promise<{ bitrixEmployeeId: number, profile }>` | Вызов `user.current`; при отсутствии `BitrixEmployee` вызывает `BITRIX_EMPLOYEE_UPSERT_PORT.upsertOne` |
| `BitrixTokenRefreshService.getValidAccessToken` | `bitrixEmployeeId` | `Promise<string>` | Обновляет токен при необходимости, возвращает валидный `access_token` |
| `BITRIX_EMPLOYEE_UPSERT_PORT.upsertOne` | `bitrixUserId` | `Promise<void>` | Создаёт/обновляет `BitrixEmployee` по данным Bitrix REST (самовосстановление на логине) |
| `SESSION_PORT.createSession` | `bitrixEmployeeId, permissions, delivery` | `Promise<{ sessionId }>` | Создание сессии (используется `auth`) |
| `SESSION_PORT.invalidateSession` | `sessionId` | `Promise<void>` | Logout |
| `SESSION_PORT.invalidateAllSessionsForEmployee` | `bitrixEmployeeId` | `Promise<void>` | Принудительная инвалидация всех сессий сотрудника |
| `SESSION_PORT.refreshPermissionsForEmployee` | `bitrixEmployeeId, permissions` | `Promise<void>` | Push новых permissions во все активные сессии сотрудника (используется `roles`) |
| `PERMISSIONS_RESOLVER_PORT.resolvePermissions` | `bitrixEmployeeId` | `Promise<string[]>` | Посчитать permissions сотрудника (используется `auth` при логине) |
| `DIRECTORY_REPOSITORY.findEmployees` | `departmentId?, options?` | `Promise<EmployeeSummary[]>` | **Существующий** метод — список сотрудников для админ-страницы ролей (используется `roles`) |
| `RolesCommandHandlers.updateRolePermissions` | `roleId, permissionCodes` | `Promise<void>` | Меняет права роли и триггерит `SESSION_PORT.refreshPermissionsForEmployee` для всех сотрудников с этой ролью |
| `RolesQueryHandlers.getPermissionsCatalog` | — | `Promise<{code, label, group}[]>` | Читает каталог `Permission` (наполнен `PermissionsCatalogSeeder`) — источник строк матрицы для `useRolePermissionsMatrix`, не редактируется через UI |
| `SessionAuthGuard.canActivate` | `ExecutionContext` | `Promise<boolean>` | Глобальная проверка сессии, throw `UnauthorizedException` при отказе |
| `PermissionsGuard.canActivate` | `ExecutionContext` | `boolean` | Глобальная проверка permissions, throw `ForbiddenException` при отказе |

---

## Frontend — UI Model

### Pages
| Page | Route | Структура | Назначение |
|---|---|---|---|
| `pages/RolesManagement` | `/admin/roles` | `ui` + `model` + `mediator` (несколько stateful-виджетов: список ролей, матрица, назначение сотрудникам) | Админ-UI управления ролями (требует `roles:manage`) |
| `pages/AccessDenied` | — (рендерится на месте защищённого роута, не отдельный URL) | `ui` | Экран "нет доступа" при прямом переходе без нужного permission |
| `pages/Login` | `/login` (standalone/iOS); не рендерится в embedded-контексте | `ui` + `model` | Экран-шлюз "Войдите через Bitrix24" для standalone-сайта/iOS без валидной сессии — CTA запускает OAuth authorization code flow по клику пользователя (см. ниже, добавлено по итогам UI-дизайна) |

### Features
| Feature | Статус | Публичный API (`index.ts`) | `model/` | Назначение |
|---|---|---|---|---|
| `features/Auth` | new | `useHasPermission`, `useCurrentUser`, `useLogout`, `useBitrixLogin`, `RequirePermission` | `api.ts` (`GET /auth/me`, `POST /auth/logout` через `queryOptions`/mutation), `authStore.ts` (Zustand: employee, permissions, status) | Сессия и permissions текущего сотрудника, условная защита UI, запуск OAuth-логина |
| `features/RoleManagement` | new | `RoleManagementPanel` (корневой UI) | `api.ts` (CRUD ролей, матрица прав, назначение/снятие ролей — запросы и мутации; список сотрудников — через уже существующий `GET /directory/employees`) | Админ-функциональность управления ролями |

### UI-компоненты
| Component | Слой | Props (основные) | Назначение |
|---|---|---|---|
| `AccessDeniedScreen` | `shared/ui-kit/organisms` | `title?`, `description?` | Презентационный экран "нет доступа", переиспользуется страницей и `RequirePermission` |
| `features/Auth/ui/RequirePermission` | `features/Auth/ui` | `permission`, `children` | Условный рендер по наличию permission, иначе `AccessDeniedScreen` |
| `features/RoleManagement/ui/RoleList` | `features/RoleManagement/ui` | `roles`, `onCreate/onRename/onDelete` | CRUD-список ролей |
| `features/RoleManagement/ui/RolePermissionMatrix` | `features/RoleManagement/ui` | `roles`, `permissions`, `onToggle` | Матрица "роль × permission" с чекбоксами |
| `features/RoleManagement/ui/EmployeeRoleAssignment` | `features/RoleManagement/ui` | `employees`, `roles`, `onAssign/onRevoke` | Список сотрудников (из `DIRECTORY_REPOSITORY`) + назначение ролей |
| `pages/RolesManagement/mediator/RolesManagementPage` | `pages/RolesManagement/mediator` | — | Оркестрация `model`-хуков `RoleManagement`, без условного рендера |
| `pages/Login/ui/LoginGate` | `pages/Login/ui` | — | Презентационный экран-шлюз с CTA `useBitrixLogin().login()` |

### Hooks (model)
| Hook | Расположение | Тип | Возвращает |
|---|---|---|---|
| `useHasPermission` | `features/Auth/model` | state-хук (читает Zustand-стор) | `boolean` |
| `useCurrentUser` | `features/Auth/model` | query options factory + хук | `{ employee, permissions, isInitialLoad }` |
| `useLogout` | `features/Auth/model` | mutation-хук | `{ logout(), isPending }` |
| `useBitrixLogin` | `features/Auth/model` | обычный хук (без запроса — формирует URL и делает redirect) | `{ login() }` — редиректит на `{portal}/oauth/authorize/` |
| `useRoles` | `features/RoleManagement/model` | query + мутации CRUD | `{ roles, createRole, renameRole, deleteRole }` |
| `useRolePermissionsMatrix` | `features/RoleManagement/model` | query + мутация | `{ matrix, togglePermission, save, isSaving }` |
| `useEmployeeRoleAssignment` | `features/RoleManagement/model` | query (существующий `/directory/employees`) + мутации ролей | `{ employees, assignRole, revokeRole }` |
| `detectRuntimeContext` | `shared/lib` | обычная функция (не хук) | `'iframe' \| 'standalone'` |

Дополнительно: `shared/api/session-token.ts` — модульный in-memory holder для `session_id` в
iframe-контексте (не React-состояние, не localStorage — читается axios-интерцептором в
`shared/api/axios.instance.ts`); контекст запуска определяется на старте приложения в `app/`
(вызывает `detectRuntimeContext`). В embedded-контексте `app/` сразу инициирует `BX24.init()` и
скрытый embedded-логин без участия пользователя. В standalone/iOS-контексте без валидной сессии
`app/` рендерит `pages/Login` — OAuth-редирект запускается по клику пользователя на CTA
(`useBitrixLogin().login()`), а не автоматически при загрузке (добавлено по итогам UI-дизайна —
избегает немого auto-redirect на каждый визит без сессии, включая случай истёкшей сессии
существующего пользователя).

### Паттерны, которые нужно учесть при проектировании
- [x] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента)
- [x] Запросы к backend — через query options factory в `model/api.ts`, не голыми async-функциями
- [x] Ошибки API нормализуются через `ApiError` в `.catch()` запроса
- [x] Для страницы `RolesManagement` (несколько stateful-виджетов) — `mediator/`-компонент без условного рендера
- [ ] Именованные слоты (`header`/`body`/`footer`) — не требуется, `RolesManagement` не Layout-контейнер
- [ ] `isInitialLoad`/`isRefreshing` — применимо к `useCurrentUser` (`isInitialLoad` до первого `/auth/me`); фильтров с "схлопыванием" тут нет
- [x] Новые компоненты — в `shared/ui-kit/`, не в `shared/ui/`

---

## Diagrams

Диаграммы размещены на существующей доске **«Bitrix24 Auth: iframe vs OAuth 2.0»** (там уже были
черновые диаграммы по той же теме — guard-пайплайн `SessionAuthGuard`→`PermissionsGuard` и оба
сценария входа через `user.current` совпадают с решениями `design.md`); три диаграммы этого change
находятся во фрейме **«add-bitrix24-auth-and-rbac — Architecture»** в свободной области доски и
обновлены под пересмотренную модель (без сущности `User`, идентичность — `BitrixEmployee`).

### 1. Domain Entity Interaction
`BitrixEmployee` (существующий, переиспользуется) + новые `BitrixEmployeeCredentials`/`Role`/
`Permission`/`Session` и VO (`BitrixCredentials`, `PermissionCode`, `SessionId`) — заменяет более
раннюю версию диаграммы, где ошибочно вводилась отдельная `User`/`IdentityKey`.

Miro link: `https://miro.com/app/board/uXjVHq7TqQ4=/?moveToWidget=3458764682777800074`

### 2. External Modules Interaction
Frontend (Web/iOS) → `auth`/`roles` через `APP_GUARD`; порты между новыми модулями
(`PERMISSIONS_RESOLVER_PORT`, `SESSION_PORT`) и переиспользование уже существующих
(`DIRECTORY_REPOSITORY` из `roles`, `BITRIX_EMPLOYEE_UPSERT_PORT` из `auth` в
`src/sync/bitrix`); внешние системы — Bitrix24 REST/OAuth, Redis, PostgreSQL.

Miro link: `https://miro.com/app/board/uXjVHq7TqQ4=/?moveToWidget=3458764682777800073`

### 3. Layer Interaction — от Controller до Response
Полный путь `PATCH /roles/:id/permissions`: `SessionAuthGuard` → `PermissionsGuard` →
`RolesController` → `UpdateRolePermissionsHandler` → `Role` (domain) → `RoleRepository` (Prisma) →
PostgreSQL, плюс побочный эффект — push новых permissions во все активные сессии затронутых
сотрудников через `SESSION_PORT` → Redis; отмечена ветка 403. Диаграмма не ссылалась на `User` и
осталась без изменений относительно первой версии.

Miro link: `https://miro.com/app/board/uXjVHq7TqQ4=/?moveToWidget=3458764682777800072`

---

## Confirmation Checklist
- [x] Названия entity/aggregate/VO согласованы (в т.ч. отказ от отдельной `User` в пользу `BitrixEmployee`)
- [x] Названия и сигнатуры ключевых методов сервисов согласованы
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [x] Диаграммы взаимодействия отражают ожидаемую реализацию
- [x] Пользователь подтвердил переход к tasks.md
