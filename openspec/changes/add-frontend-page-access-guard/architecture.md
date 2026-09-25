# Architecture: add-frontend-page-access-guard

## Scope

Чисто frontend-изменение: расширение существующего route-guard/nav-примитива под массив
permission-кодов (OR) и включение фильтрации по нему для страниц/пунктов меню, которые сегодня не
покрыты. Backend не затрагивается — ни новых, ни изменённых сущностей/эндпоинтов (см. design.md,
Non-Goals). Miro-диаграммы по решению пользователя пропущены как несоразмерные объёму change —
вместо них ниже краткое текстовое описание трёх потоков.

---

## Backend — Domain Model

Без изменений. `Role`/`Permission`/`RolePermission`/`EmployeeRole`, `GET /v1/auth/me` и все
`@RequirePermissions` на контроллерах остаются как есть — change только читает уже существующий
контракт `AuthMeResponse.permissions: string[]`.

### Entities / Aggregates / Value Objects / Services

Нет затронутых — таблицы опущены (нет новых или изменённых backend-сущностей).

---

## Frontend — UI Model

### Затронутые роуты (`app/router.tsx`)

| Route | Было | Станет |
|---|---|---|
| `salary-accruals`, `salary-accruals/:id` | без `handle` | `handle: { requiredPermission: ['service-accounting:view_accrual', 'shop-accounting:view_accrual'] }` |
| `balance`, `balance/employee/:id` | без `handle` | `handle: { requiredPermission: 'employee-balance:view_all' }` |
| `tasks` | без `handle` | `handle: { requiredPermission: 'tasks:view' }` |
| `salaries`, `salaries/employee/:employeeId` | без `handle` | `handle: { requiredPermission: ['service-accounting:view_all_salary_report', 'shop-accounting:view_all_salary_report'] }` |
| `salaries/rules`, `salaries/rules/new`, `salaries/rules/:direction/:id` | без `handle` | `handle: { requiredPermission: ['service-accounting:view', 'shop-accounting:view'] }` |
| `settings/roles`, `work-schedule`, `work-schedule/today` | уже есть `handle` | без изменений |
| `/`, `services`, `sales-plan`, `goods-turnover-report`, `settings/employee-identity`, `settings/service-accounts` | без `handle` | без изменений (backend не защищает) |

Сами страницы (`pages/*`) не меняются — правки только в конфигурации роутов и в `navigation.tsx`.

### Features

Нет новых. `features/Auth` — существующая фича, меняется публичная сигнатура одного хука (см. Hooks
ниже), реэкспорт через `index.ts` не меняется.

### UI-компоненты

| Component | Слой | Изменение |
|---|---|---|
| `RouteGuard` (`app/route-guard/ui/RouteGuard.tsx`) | existing | без структурных изменений — читает `hasRequiredPermission` из `useRouteGuardState`, которая теперь понимает массив |
| `Header` (`app/Header.tsx`) | existing | перед `.map`/`.find` по `TOP_LEVEL_NAV_ITEMS`/`SECTIONS`/`DRAWER_SECTIONS` добавляется вызов новой `filterNavItemsByPermission` |

### Hooks / utils (model)

| Hook / util | Расположение | Тип | Изменение |
|---|---|---|---|
| `useHasPermission` | `features/Auth/model/useHasPermission.ts` | state-хук (Zustand-селектор) | сигнатура `(permission: string)` → `(permission: string \| string[])`, `.some()` при массиве; dev-байпас без изменений |
| `useRouteGuardState` | `app/route-guard/model/useRouteGuardState.ts` | state-хук (TanStack Query + вычисление) | принимает `requiredPermission?: string \| string[]`, приводит к массиву (`[permission].flat()`) и делегирует проверку в `useHasPermission` вместо собственного `.includes()` |
| `filterNavItemsByPermission` | `app/navigation.tsx` (новый экспорт, рядом с существующими константами) | чистая функция `(items, hasPermission: (p) => boolean) => T[]` | новая — не хук, чтобы быть тестируемой без рендера; вызывается только из `Header.tsx` |

### Типы

| Type | Расположение | Изменение |
|---|---|---|
| `RouteHandle` | `app/route-guard/model/useRouteGuardState.ts` | `requiredPermission?: string` → `requiredPermission?: string \| string[]` |
| `NavItem` | `shared/ui-kit/organisms/Header/types.ts` | добавляется `requiredPermission?: string \| string[]` (данные, как уже существующий `disabled`) |
| `TopLevelNavItem` | `app/navigation.tsx` | без изменений формы — `matchPaths` остаётся полным (нефильтрованным) списком страниц раздела, фильтрация происходит уже после вывода `TOP_LEVEL_NAV_ITEMS` |

### Паттерны, которые нужно учесть

- [x] Запросы к backend — не создаются новые, переиспользуется `routeGuardApi.getCurrentSession()`/`useCurrentUser`
- [x] Ошибки API — не затронуто (сессия уже сворачивается в `null` в `session.api.ts`)
- [ ] mediator-компонент — не применимо, изменяемые компоненты не многовиджетные
- [ ] именованные слоты — не применимо, UI-разметка страниц не меняется
- [ ] `isInitialLoad`/`isRefreshing` — не применимо
- [x] Новый код — только в `app/` (не `shared/ui/` и не `shared/ui-kit/`, за исключением одного нового опционального поля в уже существующем `shared/ui-kit/organisms/Header/types.ts`)

---

## Diagrams (текстовое описание вместо Miro — см. Scope)

### 1. Проверка доступа к роуту
`RouteGuard` (обёртка `<Layout/>` в `router.tsx`) через `useMatches()` читает `handle.requiredPermission`
текущего совпавшего роута → передаёт в `useRouteGuardState(requiredPermission)` → тот берёт
`permissions: string[]` из кэша `GET /v1/auth/me` (тот же `AUTH_SESSION_QUERY_KEY`, что использует и
`useCurrentUser`/`authStore`) → вызывает `useHasPermission(requiredPermission)` → при `false` рендерит
`AccessDeniedPage` вместо `children`.

### 2. Фильтрация меню
`Header.tsx` на каждый рендер берёт статические `TOP_LEVEL_NAV_ITEMS`/`SECTIONS`/`DRAWER_SECTIONS`
(экспорт `app/navigation.tsx`, вычисленные один раз из `NAV_ENTRIES`) → прогоняет через
`filterNavItemsByPermission(items, useHasPermission)` → передаёт уже отфильтрованный список в
презентационные `HeaderDesktop`/`Subnav`/`NavDrawer`. Секция, где не осталось видимых пунктов, не
рендерится (та же ветка, что и сегодняшний `disabled: !primary`).

### 3. Источник данных о правах
Единственный источник — `GET /v1/auth/me` → `AuthMeResponse.permissions: string[]` → синхронизируется
в Zustand `authStore` побочным эффектом `useCurrentUser` → и `RouteGuard`, и `Header`, и точечные
`RequirePermission`-проверки внутри страниц читают один и тот же стор через `useHasPermission` — нет
отдельного канала данных для роутов и для меню.

---

## Confirmation Checklist

- [x] Названия entity/aggregate/VO согласованы — не применимо (backend не меняется)
- [x] Названия и сигнатуры ключевых методов согласованы — см. таблицы Hooks/Типы выше
- [x] Слои (app/pages/features/kernel/shared), структура и паттерны фронта согласованы — все правки в `app/`, одно поле в уже существующем `shared/ui-kit` типе
- [x] Диаграммы взаимодействия — заменены текстовым описанием по решению пользователя (Miro пропущен)
- [ ] Пользователь подтвердил переход к tasks.md
