import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { RouteGuard, routeGuardApi } from './route-guard'
import { FunnelReport } from '@/pages/FunnelReport'
import { ServicesAnalytics } from '@/pages/ServicesReport'
import { SalesPlanPage } from '@/pages/SalesPlan'
import { SalaryRulesPage } from '@/pages/SalaryRules'
import { SalaryRuleListPage } from '@/pages/SalaryRuleList'
import { SalaryRuleDetailPage } from '@/pages/SalaryRuleDetail'
import { SalaryReportV2Page } from '@/pages/SalaryReportV2'
import { SalaryAccrualsPage } from '@/pages/SalaryAccruals'
import { SalaryAccrualDocumentPage } from '@/pages/SalaryAccrualDocument'
import { EmployeeBalancePage } from '@/pages/EmployeeBalance'
import { EmployeeSettlementsPage } from '@/pages/EmployeeSettlements'
import { EmployeeIdentityPage } from '@/pages/EmployeeIdentity'
import { ServiceAccountsPage } from '@/pages/ServiceAccounts'
import { TasksPage } from '@/pages/Tasks'
import { WorkSchedulePage } from '@/pages/WorkSchedule'
import { WorkScheduleTodayPage } from '@/pages/WorkScheduleToday'
import { UiKitPreview } from '@/pages/UiKitPreview'
import { OAuthCallbackPage } from '@/pages/OAuthCallback'
import { RolesManagementPage } from '@/pages/RolesManagement'
import { GoodsTurnoverReportPage } from '@/pages/GoodsTurnoverReport'
import { queryClient } from '@/shared/api/query-client.ts'
import { api as funnelReportApi } from '@/pages/FunnelReport/model/api.ts'
import { defaults as funnelReportDefaultFilters } from '@/pages/FunnelReport/model/useFilters.tsx'

export const router = createBrowserRouter([
    {
        path: '/',
        // Первая реализация route-guard в проекте (add-bitrix24-auth-and-
        // rbac, раздел 15 tasks.md): в standalone-контексте без валидной
        // сессии рендерит `pages/Login` вместо `<Layout />` и его детей; на
        // защищённых роутах (см. `handle.requiredPermission` у отдельных
        // роутов ниже) без нужного permission — `pages/AccessDenied`.
        element: (
            <RouteGuard>
                <Layout />
            </RouteGuard>
        ),
        children: [
            {
                index: true,
                element: <FunnelReport />,
                // Без сессии (standalone-контекст без валидного логина) прыгать сразу в
                // ensureQueryData нельзя: запросы вернут 401, а queryFn по конвенции проекта
                // осознанно бросает ApiError — не пойманный здесь loader роняет весь роут в
                // дефолтный ErrorBoundary react-router вместо LoginPage, которую должен был
                // отрендерить RouteGuard (обнаружено при тестировании OAuth-логина через ngrok:
                // "/" не редиректил на логин, хотя остальные роуты без такого loader'а — редиректили).
                // Проверяем ту же кэшированную сессию, что и RouteGuard, и просто пропускаем
                // prefetch без сессии — FunnelReport в этом случае всё равно не смонтируется.
                loader: async () => {
                    const session = await queryClient.ensureQueryData(routeGuardApi.getCurrentSession())
                    if (session === null) return null

                    return Promise.all([
                        queryClient.ensureQueryData(funnelReportApi.getFilterOptions()),
                        queryClient.ensureQueryData(funnelReportApi.getDeals(funnelReportDefaultFilters)),
                    ])
                },
            },
            {
                path: 'services',
                element: <ServicesAnalytics />,
            },
            {
                path: 'sales-plan',
                element: <SalesPlanPage />,
            },
            {
                // Отчёт по оборачиваемости товаров (openspec/changes/service-turnover-report,
                // задача 15.2; ui-design.md `WvSO6`/`yDBTb`) — новый модуль `domains/service/
                // modules/warehouse` на бэкенде. Пока каркас (`GoodsTurnoverReportPage` — только
                // `Layout` без Filter Row/таблицы, см. её комментарий) — наполняется задачами 16-19.
                path: 'goods-turnover-report',
                element: <GoodsTurnoverReportPage />,
            },
            {
                // Отчёт по зарплате (Pencil: design/sallary-first-iteration.pen, `wLtzp`/`b63e8p`
                // "Зарплата сотрудника" + `wVa5g`/`z5BwMk` "Зарплата отдела", `pages/SalaryReportV2`
                // — исходный, ранее не переработанный дизайн этой страницы удалён вместе с роутом
                // `/salaries-v2`, по которому этот компонент временно жил рядом со старым для
                // сравнения). По умолчанию показывает отчёт отдела.
                path: 'salaries',
                element: <SalaryReportV2Page />,
                // add-frontend-page-access-guard, раздел 4 tasks.md — отчёт объединяет service +
                // shop, backend закрывает каждое направление отдельным кодом
                // (`domains/service/modules/accounting/salary-report.controller.ts`,
                // `domains/shop/modules/accounting/salary-report.controller.ts`, оба
                // `@RequirePermissions('...-accounting:view_all_salary_report')`) — OR-семантика
                // массива (задача 2).
                handle: {
                    requiredPermission: [
                        'service-accounting:view_all_salary_report',
                        'shop-accounting:view_all_salary_report',
                    ],
                },
            },
            {
                // Отчёт сотрудника — свой URL (тот же приём, что `balance/employee/:id` у баланса,
                // см. её комментарий чуть ниже): открывается кнопкой «Открыть отчёт» из строки
                // сотрудника в отчёте отдела (`DepartmentEmployeeGroupV2`) или напрямую по ссылке.
                // Тот же компонент `SalaryReportV2Page` — режим и выбранный сотрудник читаются из
                // `:employeeId` в `useSalaryReportPage` (см. её комментарий).
                path: 'salaries/employee/:employeeId',
                element: <SalaryReportV2Page />,
                // Тот же код, что у `salaries` выше — отчёт сотрудника доступен тому же кругу
                // пользователей, что и отчёт отдела, из которого на него переходят.
                handle: {
                    requiredPermission: [
                        'service-accounting:view_all_salary_report',
                        'shop-accounting:view_all_salary_report',
                    ],
                },
            },
            {
                // Фаза 6 плана "График работы сотрудников" (docs/employee-work-schedule) — путь
                // задан явно планом задачи ('/work-schedule'), а не переиспользует прежний
                // плейсхолдер '/schedule' из app/navigation.tsx (см. правку STANDALONE_ITEM там же).
                // requiredPermission — тот же механизм, что у settings/roles (app/route-guard/ui/
                // RouteGuard.tsx, раздел 15); work-schedule:view закрывает и сам роут, и
                // соответствующие GET-эндпоинты бэкенда (backend/src/modules/work-schedule).
                path: 'work-schedule',
                element: <WorkSchedulePage />,
                handle: { requiredPermission: 'work-schedule:view' },
            },
            {
                // Фаза 9 плана "График работы сотрудников" — мобильный экран «Отдел сегодня»
                // (узел `A5SbT`, `pages/WorkScheduleToday`). Отдельный путь, а не адаптивный
                // вариант '/work-schedule' — макет A5SbT самостоятельная страница со своей
                // информационной архитектурой (лента недели + ростер), а не отзывчивая версия
                // таблицы «сотрудники × дни месяца».
                path: 'work-schedule/today',
                element: <WorkScheduleTodayPage />,
                handle: { requiredPermission: 'work-schedule:view' },
            },
            {
                // Фаза 5 плана "Закрытие месяца и начисления" (docs/payroll-closing-and-accrual) —
                // список документов начисления закрытого месяца. Адрес с query
                // `?period=YYYY-MM&direction=` уже собирают переход после закрытия месяца и кнопка
                // «Начисления за {месяц}» на странице плана продаж (Фаза 4, useSalesPlanPage).
                path: 'salary-accruals',
                element: <SalaryAccrualsPage />,
                // add-frontend-page-access-guard, раздел 4 tasks.md — список объединяет
                // начисления service + shop, backend закрывает каждый источник отдельным кодом
                // (`domains/service/modules/accounting/*.controller.ts`, `domains/shop/modules/
                // accounting/*.controller.ts`, оба `@RequirePermissions('...-accounting:view_accrual')`);
                // OR-семантика массива (задача 2) — достаточно доступа хотя бы к одному направлению.
                handle: {
                    requiredPermission: ['service-accounting:view_accrual', 'shop-accounting:view_accrual'],
                },
            },
            {
                // Карточка документа начисления. Направление — query-параметр `?direction=`
                // (GET живёт под префиксом направления), а не сегмент пути — путь задан планом
                // Фазы 5 буквально как '/salary-accruals/:id'.
                path: 'salary-accruals/:id',
                element: <SalaryAccrualDocumentPage />,
                // Тот же код, что у списка `salary-accruals` выше — карточка документа доступна тому
                // же кругу пользователей, что и список, из которого на неё переходят.
                handle: {
                    requiredPermission: ['service-accounting:view_accrual', 'shop-accounting:view_accrual'],
                },
            },
            {
                // «Взаиморасчёты с сотрудниками» (пункт меню «Зарплата», ранее «Выплата»,
                // app/navigation.tsx) — docs/employee-settlements-page-redesign, Фаза 3.
                // Заменяет прежний 'balance/department' (`DepartmentBalancesPage`, сводка ТОЛЬКО
                // по выбранному отделу) сквозным списком по всем сотрудникам компании;
                // `departmentId` — необязательный query-параметр (`?departmentId=`, отсутствует
                // = «Все отделы»), тот же приём, что у прежнего роута.
                path: 'balance',
                element: <EmployeeSettlementsPage />,
                // add-frontend-page-access-guard, раздел 4 tasks.md — сквозной список по всем
                // отделам защищён на backend `@RequirePermissions('employee-balance:view_all')`
                // (`domains/service/modules/accounting/employee-balance.controller.ts`).
                handle: { requiredPermission: 'employee-balance:view_all' },
            },
            {
                // Баланс сотрудника — общий, без направления в пути (Фаза 8b: баланс живёт
                // под /v1/accounting/balance, вне /v1/service и /v1/shop). Открывается из
                // таблицы балансов отдела ("Открыть баланс") и, в будущем, из карточки
                // документа начисления.
                path: 'balance/employee/:id',
                element: <EmployeeBalancePage />,
                // Тот же код, что у `balance` выше — карточка баланса сотрудника доступна тому же
                // кругу пользователей, что и список, из которого на неё переходят. Own-resource
                // fallback (add-employee-balance-own-view, backend —
                // EmployeeBalanceOwnershipGuard): без `employee-balance:view_all` роут остаётся
                // доступен, если у пользователя есть `employee-balance:view_own` И `:id` — его
                // собственный (см. WHY в RouteHandle, app/route-guard/model/useRouteGuardState.ts).
                handle: {
                    requiredPermission: 'employee-balance:view_all',
                    ownResourcePermission: 'employee-balance:view_own',
                    ownResourceParam: 'id',
                },
            },
            {
                // replace-bitrix-task-integration, раздел 13 tasks.md; ui-design.md `iZrrX`/`cHCoj`/
                // `JlkUN` — самостоятельный раздел «Задачи» (`app/navigation.tsx`'s
                // `TASKS_STANDALONE_ITEM`), список всех задач независимо от зарплатных правил.
                path: 'tasks',
                element: <TasksPage />,
                // add-frontend-page-access-guard, раздел 4 tasks.md — список задач защищён на
                // backend `@RequirePermissions('tasks:view')` (`domains/service/modules/tasks/
                // tasks.controller.ts`).
                handle: { requiredPermission: 'tasks:view' },
            },
            {
                path: 'salaries/rules',
                element: <SalaryRuleListPage />,
                // add-frontend-page-access-guard, раздел 4 tasks.md — список схем начисления
                // объединяет service + shop, backend закрывает каждое направление отдельным кодом
                // (`domains/service/modules/accounting/motivation-schema.controller.ts`,
                // `domains/shop/modules/accounting/motivation-schema.controller.ts`, оба
                // `@RequirePermissions('...-accounting:view')`) — OR-семантика массива (задача 2).
                handle: { requiredPermission: ['service-accounting:view', 'shop-accounting:view'] },
            },
            {
                path: 'salaries/rules/new',
                element: <SalaryRulesPage />,
                // Тот же код, что у `salaries/rules` выше — создание схемы доступно тому же кругу
                // пользователей, что и список.
                handle: { requiredPermission: ['service-accounting:view', 'shop-accounting:view'] },
            },
            {
                // Схема-редактирование (см. `pages/SalaryRuleDetail`) — `:direction` часть пути, а
                // не query-параметр: он выбирает, какая пара GET/PATCH-эндпоинтов
                // (`/v1/service/motivation-schema/:id` vs `/v1/shop/accounting/motivation-schema/:id`)
                // обслуживает эту схему (см. план "Редактирование зарплатных схем", routingPlan).
                // `SchemaCard`-ссылки (`pages/SalaryRuleList/ui/SchemaGrid.tsx`/`SchemaListMobile.tsx`)
                // уже собирают этот путь с направлением схемы.
                path: 'salaries/rules/:direction/:id',
                element: <SalaryRuleDetailPage />,
                // Тот же код, что у `salaries/rules` выше — редактирование конкретной схемы
                // доступно тому же кругу пользователей, что и список.
                handle: { requiredPermission: ['service-accounting:view', 'shop-accounting:view'] },
            },
            // Раздел «Настройки» (см. `app/navigation.tsx`, секция «Настройки»). Вложенные пути
            // задаются отдельными строками без ведущего слэша — отдельный layout-роут для
            // `/settings` не заведён, оба пункта раздела регистрируются рядом друг с другом.
            {
                path: 'settings/employee-identity',
                element: <EmployeeIdentityPage />,
            },
            {
                // Переключатель «служебный аккаунт» (docs/employee-ordering-and-salary-filter,
                // Фаза 4) — второй пункт раздела «Настройки».
                path: 'settings/service-accounts',
                element: <ServiceAccountsPage />,
            },
            {
                // add-bitrix24-auth-and-rbac, раздел 20.8 tasks.md; ui-design.md `s5nMLx`/`F6d3a`
                // — админ-страница управления ролями. Третий пункт раздела «Настройки» (рядом со
                // «Связи сотрудников»/«Служебные аккаунты» выше) — вкладка в Subnav, а не
                // отдельная ссылка вне раздела, поэтому путь под общим префиксом `settings/`, а
                // не `admin/`. `handle.requiredPermission` — механизм раздела 15
                // (`app/route-guard/ui/RouteGuard.tsx`), уже готовый и покрытый тестами до этой
                // задачи; без `roles:manage` у текущего сотрудника `RouteGuard` рендерит
                // `pages/AccessDenied` вместо этого роута (вкладка при этом всё равно видна в
                // Subnav — сам список пунктов «Настройки» permission не фильтрует, как и два
                // других пункта раздела).
                path: 'settings/roles',
                element: <RolesManagementPage />,
                handle: { requiredPermission: 'roles:manage' },
            },
        ],
    },
    // Dev-only UI Kit preview route — rendered without the current app chrome (no <Layout>)
    // so the new design language can be inspected in isolation. See
    // docs/ui-kit-new-header/plan-ui-kit-new-header.md.
    {
        path: '/ui-kit-preview',
        element: <UiKitPreview />,
    },
    {
        // add-bitrix24-auth-and-rbac, раздел 23 tasks.md; architecture.md `pages/OAuthCallback`.
        // На практике Bitrix24 для локальных приложений редиректит не сюда, а на корень сайта
        // (см. `RouteGuard` — там та же страница рендерится при `?code=` в query под `/`) —
        // роут оставлен на случай изменения "Пути вашего обработчика" в настройках приложения
        // на значение с этим путём.
        path: '/auth/callback',
        element: <OAuthCallbackPage />,
    },
])
