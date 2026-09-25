## Context

См. `proposal.md` — Why/What Changes. Текущее устройство (детали, не мотивация):

- `frontend/src/app/router.tsx`: один layout-роут `/` под `<RouteGuard><Layout/></RouteGuard>`,
  дети — плоский список страниц. Только 2 роута (`settings/roles`, `work-schedule*`) несут
  `handle: { requiredPermission: 'code' }`.
- `frontend/src/app/route-guard/`: `RouteGuard.tsx` читает `handle.requiredPermission` через
  `useMatches()`, `useRouteGuardState.ts` сверяет его с `permissions: string[]` из
  `GET /v1/auth/me` (Zustand `authStore`). `RouteHandle.requiredPermission` сейчас `string`.
- `frontend/src/app/navigation.tsx`: `NAV_ENTRIES` — статический массив, вычисляется один раз на
  этапе импорта модуля (не хук, без доступа к текущему пользователю). Из него `.map`/`.filter`
  выводятся `TOP_LEVEL_NAV_ITEMS`/`SECTIONS`/`DRAWER_SECTIONS`/`ALL_LEAVES` — тоже статические
  константы. Единственный потребитель всех четырёх — `app/Header.tsx` (компонент, хуки доступны);
  `navigation.test.ts`/`navOrder.test.ts`/`drawerActiveItem.test.ts`/`subnavActiveTab.test.ts`
  импортируют те же константы напрямую и проверяют порядок/активный пункт — эта логика не должна
  зависеть от permissions.
- `useHasPermission(permission: string): boolean` (`features/Auth/model`) — синхронный селектор
  Zustand, принимает один код.
- Аудит backend `@RequirePermissions` по ключевым GET-эндпоинтам страниц (см. таблицу в Decisions)
  показал: часть страниц (`/`, `/services`, `/sales-plan`, `/goods-turnover-report`,
  `/settings/employee-identity`, `/settings/service-accounts`) сегодня не защищена на backend
  никаким permission-кодом — только валидной сессией.

## Goals / Non-Goals

**Goals:**
- Привести frontend-защиту к 1:1 соответствию с текущей backend-защитой (`@RequirePermissions`) на
  каждой странице `router.tsx`.
- Скрывать пункт меню, если ни один из permissions, защищающих раздел, не назначен пользователю.
- Поддержать на фронте те же составные (multi-domain, `service`/`shop`) страницы, что и на backend,
  без ложного полного запрета при частичном доступе (OR-семантика).

**Non-Goals:**
- Не вводятся новые backend permission-коды и не меняется backend-enforcement — только
  frontend-отражение уже существующего. Если у страницы сегодня нет `@RequirePermissions` на
  backend, у неё не появляется `requiredPermission` и на фronte (не изобретаем требование).
  Так и остаётся: `/`, `/services`, `/sales-plan`, `/goods-turnover-report`,
  `/settings/employee-identity`, `/settings/service-accounts`.
- Не трогаем `tasks:view_own`/`*:view_own_salary_report`/`*:view_department_salary_report` —
  коды есть в каталоге, но backend их не проверяет ни одним guard'ом; давать им действие только на
  frontend создало бы несоответствие backend/frontend (спрятанный на фронте элемент, доступный по
  прямому запросу к API, и наоборот).
- Не меняется логика подсветки активного пункта меню (`isTopLevelNavItemActive`,
  `findMostSpecificNavMatch`) — она остаётся permission-агностичной и продолжает работать поверх
  полного, нефильтрованного списка страниц раздела.
- Действия внутри страницы (создание/редактирование, `manage_schema`/`edit_accrual` и т.п.)
  остаются на существующем примитиве `RequirePermission`/`useHasPermission` — этот change трогает
  только видимость самой страницы/пункта меню, не её внутренних контролов.

## Decisions

### Маршрут → защищающий permission (аудит `@RequirePermissions` по страницам)

| Роут | `requiredPermission` |
|---|---|
| `/` (FunnelReport), `/services`, `/sales-plan`, `/goods-turnover-report`, `/settings/employee-identity`, `/settings/service-accounts` | не задаётся — backend не проверяет permission на их ключевых GET-эндпоинтах |
| `/salary-accruals`, `/salary-accruals/:id` | `['service-accounting:view_accrual', 'shop-accounting:view_accrual']` |
| `/balance`, `/balance/employee/:id` | `'employee-balance:view_all'` |
| `/tasks` | `'tasks:view'` |
| `/salaries`, `/salaries/employee/:employeeId` | `['service-accounting:view_all_salary_report', 'shop-accounting:view_all_salary_report']` |
| `/salaries/rules`, `/salaries/rules/new`, `/salaries/rules/:direction/:id` | `['service-accounting:view', 'shop-accounting:view']` |
| `/work-schedule`, `/work-schedule/today` | `'work-schedule:view'` (уже реализовано, без изменений) |
| `/settings/roles` | `'roles:manage'` (уже реализовано, без изменений) |

Список фиксируется буквально в `router.tsx`/`navigation.tsx` (тот же приём, что уже применён для
`settings/roles`/`work-schedule`) — без динамической интроспекции backend-декораторов. Если позже
у эндпоинта поменяется `@RequirePermissions`, frontend не подхватит это автоматически — комментарий
у каждой записи должен указывать на backend-контроллер, откуда взят код (по аналогии с уже
существующим комментарием у `work-schedule`).

### `RouteHandle.requiredPermission`: `string` → `string | string[]`, OR-семантика

Альтернатива — оставить `string` и завести отдельный `requiredPermissionsAny: string[]` — отклонена:
две параллельные проверки в `RouteGuard`/`useRouteGuardState` вместо одной, и большинство вызовов
(`settings/roles`, `work-schedule`) всё равно передавали бы одно значение, усложняя форму без пользы.
`string | string[]` с приведением к массиву внутри `useRouteGuardState` (`[permission].flat()`)
покрывает оба случая одним полем; семантика — "достаточно любого одного", это соответствует
единственному реальному сегодняшнему кейсу (страницы, объединяющие `service`+`shop`) и не требует
поддержки AND на фронте (AND уже проверяется на backend внутри каждого отдельного эндпоинта).

### `NavItem`/`TopLevelNavItem`: `requiredPermission?: string | string[]` как данные, фильтрация — в `Header.tsx`

`requiredPermission` добавляется в `shared/ui-kit/organisms/Header/types.ts`'s `NavItem` тем же
способом, что уже есть `disabled` — просто поле данных, без бизнес-логики в `shared`. Сама
фильтрация (нужен доступ к `useHasPermission`/`authStore`, то есть хук) происходит не в
`app/navigation.tsx` (там статические константы, вычисляемые вне React-дерева и переиспользуемые
тестами в исходном, нефильтрованном виде), а в `app/Header.tsx` — единственном рантайм-потребителе:
перед `.map`/`.find` по `TOP_LEVEL_NAV_ITEMS`/`SECTIONS`/`DRAWER_SECTIONS` применяется новая чистая
функция `filterNavItemsByPermission(items, hasAnyPermission)` (кладётся рядом, в
`app/navigation.tsx`, экспортируется отдельно от констант, тестируется как чистая функция без
рендера). Правило то же, что уже действует для `disabled`: секция, где после фильтрации не осталось
ни одного видимого пункта, целиком пропадает из Subnav/Drawer и из топ-уровня (та же ветка кода, что
сегодня даёт `disabled: !primary`, — теперь `primary` ищется среди видимых, а не только среди
`!disabled`, пунктов).

### `useHasPermission` расширяется на массив, а не дублируется

`useHasPermission(permission: string | string[]): boolean` — при массиве возвращает `true`, если
выполнен хотя бы один код (`.some()`), сохраняя текущую сигнатуру и dev-байпас
(`VITE_AUTH_DISABLED`) как есть. Один хук, используемый и `RouteGuard`, и `Header`, и существующими
местами точечной проверки (`RequirePermission`), вместо второго хука с той же Zustand-подпиской —
меньше поверхности для рассинхронизации по мере появления новых multi-permission кейсов.

## Risks / Trade-offs

- [Список `requiredPermission` в `router.tsx`/`navigation.tsx` разойдётся с backend
  `@RequirePermissions`, если последний поменяют без синхронного обновления фронта] → Backend
  всё равно останется единственным источником правды и вернёт 403 (см. spec: «Backend не
  полагается на проверку frontend») — рассинхронизация ухудшает UX (лишний "нет доступа" или лишний
  видимый, но бьющий в 403 пункт меню), а не создаёт уязвимость.
- [Страницы без `@RequirePermissions` на backend (`/`, `/services`, `/sales-plan`,
  `/goods-turnover-report`, `/settings/employee-identity`, `/settings/service-accounts`) остаются
  видимы и доступны любому аутентифицированному пользователю] → Осознанно, см. Non-Goals; если
  бизнес хочет ограничить и их, это отдельное backend-изменение (новый `@RequirePermissions`), а не
  часть этого change.
- [Секция «Настройки» после фильтрации может остаться с одним пунктом или полностью пропасть для
  пользователя без ни одного из permissions её страниц] → Уже штатно обрабатываемый в
  `TOP_LEVEL_NAV_ITEMS` случай (тот же код, что и для `disabled`), просто с другим условием
  видимости — не новый класс поведения UI.

## Migration Plan

Чисто additive для UI: расширение типов (`string | string[]`) обратно совместимо с существующими
`requiredPermission: 'roles:manage'`/`'work-schedule:view'` литералами. Отдельного релиза backend не
требуется — все используемые коды уже существуют в каталоге и назначены ролям. Откат — обычный
откат frontend-деплоя, без миграции данных.
