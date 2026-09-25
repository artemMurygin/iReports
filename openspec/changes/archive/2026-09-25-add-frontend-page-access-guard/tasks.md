## 1. `useHasPermission`: OR-семантика для массива permissions

- [x] 1.1 В `frontend/src/features/Auth/model/useHasPermission.spec.ts` написать тесты: массив с хотя бы одним permission в сторе → `true`; массив без единого совпадения → `false`; пустой массив → `false`; одиночная строка (текущее поведение) не ломается; dev-байпас (`VITE_AUTH_DISABLED`) по-прежнему форсирует `true` и для массива
- [x] 1.2 Прогнать `useHasPermission.spec.ts` и зафиксировать, что новые тесты падают (red) — хук ещё принимает только `string`
- [x] 1.3 Реализовать `useHasPermission(permission: string | string[]): boolean` в `frontend/src/features/Auth/model/useHasPermission.ts` (`.some()` по массиву, `[permission].flat()`)
- [x] 1.4 Прогнать `useHasPermission.spec.ts` — зелёный; прогнать `frontend/src/features/Auth/ui/RequirePermission.spec.tsx` — без регрессий (потребитель хука с одиночной строкой)

## 2. `RouteHandle`/`useRouteGuardState`/`RouteGuard`: поддержка `string[]` в `requiredPermission`

- [x] 2.1 В `frontend/src/app/route-guard/ui/RouteGuard.spec.tsx` добавить кейсы: роут с `requiredPermission: ['a', 'b']` и пользователем, у которого есть только `'b'` → рендерит `children`; с пользователем без `'a'` и `'b'` → рендерит `AccessDeniedPage`
- [x] 2.2 Прогнать `RouteGuard.spec.tsx` и зафиксировать red — `useRouteGuardState` пока сравнивает только одиночный `string` через `.includes()`
- [x] 2.3 В `frontend/src/app/route-guard/model/useRouteGuardState.ts` изменить тип `RouteHandle.requiredPermission` на `string | string[]` и делегировать проверку в `useHasPermission` (задача 1) вместо собственного `session?.permissions.includes(...)`
- [x] 2.4 Прогнать `RouteGuard.spec.tsx` целиком — зелёный, старые кейсы с одиночной строкой не сломаны

## 3. `filterNavItemsByPermission`: чистая функция фильтрации пунктов меню

- [x] 3.1 Создать `frontend/src/app/navigation.filterByPermission.spec.ts` с тестами на будущую `filterNavItemsByPermission<T extends { requiredPermission?: string | string[] }>(items: T[], hasPermission: (p: string | string[]) => boolean): T[]`: пункт без `requiredPermission` — всегда в результате; пункт с `requiredPermission`, на который `hasPermission` вернул `false`, — исключён; пункт, на который `hasPermission` вернул `true`, — включён, порядок остальных сохранён
- [x] 3.2 Прогнать новый файл и зафиксировать red — функции ещё нет
- [x] 3.3 Добавить `requiredPermission?: string | string[]` в `NavItem` (`frontend/src/shared/ui-kit/organisms/Header/types.ts`) и реализовать `filterNavItemsByPermission` в `frontend/src/app/navigation.tsx` (экспортируемая чистая функция рядом с `NAV_ENTRIES`)
- [x] 3.4 Прогнать `navigation.filterByPermission.spec.ts` — зелёный; прогнать `navigation.test.ts`/`navOrder.test.ts`/`drawerActiveItem.test.ts`/`subnavActiveTab.test.ts` — без регрессий (они работают с нефильтрованными `TOP_LEVEL_NAV_ITEMS`/`SECTIONS`/`DRAWER_SECTIONS` и не должны увидеть разницы)

## 4. Проставить `requiredPermission` в `app/router.tsx` по таблице architecture.md

- [x] 4.1 Создать `frontend/src/app/router.permissions.spec.ts`: импортировать `router` и для каждого пути из таблицы architecture.md («Затронутые роуты») проверить `route.handle?.requiredPermission` — `salary-accruals`/`salary-accruals/:id` → `['service-accounting:view_accrual', 'shop-accounting:view_accrual']`; `balance`/`balance/employee/:id` → `'employee-balance:view_all'`; `tasks` → `'tasks:view'`; `salaries`/`salaries/employee/:employeeId` → `['service-accounting:view_all_salary_report', 'shop-accounting:view_all_salary_report']`; `salaries/rules`/`salaries/rules/new`/`salaries/rules/:direction/:id` → `['service-accounting:view', 'shop-accounting:view']`; и что `settings/roles`/`work-schedule`/`work-schedule/today` не изменились
- [x] 4.2 Прогнать `router.permissions.spec.ts` и зафиксировать red — у перечисленных роутов `handle` пока нет
- [x] 4.3 Проставить `handle: { requiredPermission: ... }` на соответствующих записях `frontend/src/app/router.tsx` (со ссылкой в комментарии на backend-контроллер, откуда взят код — по аналогии с уже существующим комментарием у `work-schedule`)
- [x] 4.4 Прогнать `router.permissions.spec.ts` — зелёный; прогнать `RouteGuard.spec.tsx` — без регрессий

## 5. Проставить `requiredPermission` в `app/navigation.tsx` по тем же роутам

- [x] 5.1 Расширить `frontend/src/app/navigation.filterByPermission.spec.ts` (или отдельный файл) тестом, сверяющим `requiredPermission` каждого пункта `NAV_ENTRIES` из задачи 4.1 с `handle.requiredPermission` соответствующего пути в `router` (та же таблица) — защита от рассинхронизации меню и роутинга
- [x] 5.2 Прогнать тест и зафиксировать red — у пунктов `NAV_ENTRIES` `requiredPermission` пока не проставлен
- [x] 5.3 Проставить `requiredPermission` на соответствующих элементах `NAV_ENTRIES` (`frontend/src/app/navigation.tsx`): «Начисления» (`/salary-accruals`), «Взаиморасчёты» (`/balance`), «Задачи» (`TASKS_STANDALONE_ITEM`), «Отчёт по зарплате» (`/salaries`), «Правила начисления» (`/salaries/rules`)
- [x] 5.4 Прогнать тест из 5.1 — зелёный

## 6. `Header.tsx`: применить фильтрацию к пунктам меню (Subnav/Nav Bar/Drawer)

- [x] 6.1 Создать `frontend/src/app/Header.spec.tsx` (рендер `<Header/>` в `MemoryRouter` + `QueryClientProvider`, `authStore.setAuthenticated({ employee, permissions })` перед рендером — по образцу `RouteGuard.spec.tsx`): у пользователя без `tasks:view` пункт «Задачи» не рендерится в Nav Bar/Drawer; у пользователя с `tasks:view` — рендерится; у пользователя без ни одного из `service-accounting:view`/`shop-accounting:view` вкладка «Правила начисления» не рендерится в Subnav раздела «Зарплата», но остальные вкладки раздела («Отчёт по зарплате» и т.д., если доступны) — рендерятся
- [x] 6.2 Прогнать `Header.spec.tsx` и зафиксировать red — фильтрация пока не применяется
- [x] 6.3 В `frontend/src/app/Header.tsx` применить `filterNavItemsByPermission` (задача 3) с колбэком на `useHasPermission` к источникам `navItems`/`subnavTabs`/`drawerSections` (`TOP_LEVEL_NAV_ITEMS`, `activeSection.items`, `DRAWER_SECTIONS`) до вычисления `active`
- [x] 6.4 Прогнать `Header.spec.tsx` — зелёный; прогнать весь `frontend/src/app` набор тестов — без регрессий

## 7. Финальная проверка

- [x] 7.1 `npm run lint` и `npm run build` в `frontend/` — без ошибок
- [ ] 7.2 `npm run start` в `frontend/`, вручную в браузере: пользователем без `tasks:view` (или через `VITE_AUTH_DISABLED`/тестовую роль) убедиться, что пункт «Задачи» не виден в шапке и прямой переход на `/tasks` показывает экран «нет доступа»; пользователем с полным набором прав — все пункты меню видны и страницы открываются как раньше — **не выполнено**: требует реальной сессии Bitrix24, которой нет в этой среде; `VITE_AUTH_DISABLED` обходит именно ту проверку, которую нужно тестировать вручную, поэтому не может её заменить. Остаётся на усмотрение пользователя.
