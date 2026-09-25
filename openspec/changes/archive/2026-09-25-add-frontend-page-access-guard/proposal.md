## Why

Спека `roles` уже требует, чтобы пользователь без нужного permission не видел пункт меню и получал
экран «нет доступа» при прямом переходе по URL (`openspec/specs/roles/spec.md`, требование «Защита
страниц/роутов на frontend»). Фактически это реализовано лишь частично: примитивы для этого есть
(`RouteGuard` + `handle.requiredPermission`, `useHasPermission`, `RequirePermission`), но
route-guard'ом покрыты только 2 из ~20 маршрутов (`settings/roles`, `work-schedule*`), а меню
(`navigation.tsx`) вообще не фильтруется по правам — пункты видны всем независимо от permissions.
Пользователь без прав сейчас видит в навигации разделы, куда не может зайти, и узнаёт об этом только
после перехода. Нужно довести frontend-защиту до состояния, уже описанного в спеке, на всех
существующих защищённых разделах.

## What Changes

- Проставить `handle: { requiredPermission }` в `frontend/src/app/router.tsx` для всех маршрутов,
  чьи данные защищены на backend через `@RequirePermissions(...)` (сверить по каталогу из 34
  permission-кодов), а не только для `settings/roles` и `work-schedule`.
- Расширить `RouteHandle.requiredPermission` с `string` до `string | string[]` (семантика
  «достаточно одного из перечисленных», по аналогии со случаями вроде
  `service-accounting:view_own_salary_report` / `view_department_salary_report` /
  `view_all_salary_report`, где доступ к одной странице даёт любой из нескольких кодов) и обновить
  `useRouteGuardState`/`RouteGuard` под новую сигнатуру.
- Добавить фильтрацию пунктов `NAV_ENTRIES` (`frontend/src/app/navigation.tsx`) по правам текущего
  пользователя через `useHasPermission`, по аналогии с уже существующим полем `disabled`: пункт, на
  требуемый permission которого у пользователя нет прав, не рендерится (ни в Sidebar, ни в
  Subnav/Drawer).
- Не менять backend: `PermissionsGuard`/`@RequirePermissions` остаются единственным источником
  истины для авторизации; frontend-проверка — только для UX (скрытие/экран «нет доступа»).

## Capabilities

### New Capabilities

_(нет — используется существующий примитив roles/route-guard)_

### Modified Capabilities

- `roles`: уточняется и полностью реализуется требование «Защита страниц/роутов на frontend» —
  явно фиксируется охват (все permission-защищённые на backend страницы, а не только
  `settings/roles`/`work-schedule`) и поддержка нескольких permissions на одном роуте с
  OR-семантикой; также реализуется до конца соседнее требование «Условная видимость элементов
  управления» применительно к пунктам меню (сейчас пункты меню не скрываются вообще).

## Impact

- `frontend/src/app/router.tsx` — добавление `handle.requiredPermission` на маршруты.
- `frontend/src/app/navigation.tsx` — фильтрация `NAV_ENTRIES`/`TOP_LEVEL_NAV_ITEMS`/`DRAWER_SECTIONS`/`SECTIONS`
  по permissions.
- `frontend/src/app/route-guard/model/useRouteGuardState.ts`, `RouteGuard.tsx` — поддержка массива
  permissions.
- `frontend/src/features/Auth/model/useHasPermission.ts` — возможно, вспомогательный хук для
  проверки «любого из списка» permissions (или логика инлайнится в route-guard/navigation).
- Backend, `contracts/`, БД — без изменений (permission-коды и `@RequirePermissions` уже есть).
