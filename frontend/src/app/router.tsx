import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { FunnelReport } from '@/pages/FunnelReport'
import { ServicesAnalytics } from '@/pages/ServicesReport'
import { SalesPlanPage } from '@/pages/SalesPlan'
import { SalaryRulesPage } from '@/pages/SalaryRules'
import { SalaryRuleListPage } from '@/pages/SalaryRuleList'
import { SalaryRuleDetailPage } from '@/pages/SalaryRuleDetail'
import { SalaryReportPage } from '@/pages/SalaryReport'
import { SalaryAccrualsPage } from '@/pages/SalaryAccruals'
import { SalaryAccrualDocumentPage } from '@/pages/SalaryAccrualDocument'
import { EmployeeBalancePage } from '@/pages/EmployeeBalance'
import { DepartmentBalancesPage } from '@/pages/DepartmentBalances'
import { EmployeeIdentityPage } from '@/pages/EmployeeIdentity'
import { WorkSchedulePage } from '@/pages/WorkSchedule'
import { WorkScheduleTodayPage } from '@/pages/WorkScheduleToday'
import { UiKitPreview } from '@/pages/UiKitPreview'
import { queryClient } from '@/shared/api/query-client.ts'
import { api as funnelReportApi } from '@/pages/FunnelReport/model/api.ts'
import { defaults as funnelReportDefaultFilters } from '@/pages/FunnelReport/model/useFilters.tsx'

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                index: true,
                element: <FunnelReport />,
                loader: () =>
                    Promise.all([
                        queryClient.ensureQueryData(funnelReportApi.getFilterOptions()),
                        queryClient.ensureQueryData(funnelReportApi.getDeals(funnelReportDefaultFilters)),
                    ]),
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
                path: 'salaries',
                element: <SalaryReportPage />,
            },
            {
                // Фаза 6 плана "График работы сотрудников" (docs/employee-work-schedule) — путь
                // задан явно планом задачи ('/work-schedule'), а не переиспользует прежний
                // плейсхолдер '/schedule' из app/navigation.tsx (см. правку STANDALONE_ITEM там же).
                path: 'work-schedule',
                element: <WorkSchedulePage />,
            },
            {
                // Фаза 9 плана "График работы сотрудников" — мобильный экран «Отдел сегодня»
                // (узел `A5SbT`, `pages/WorkScheduleToday`). Отдельный путь, а не адаптивный
                // вариант '/work-schedule' — макет A5SbT самостоятельная страница со своей
                // информационной архитектурой (лента недели + ростер), а не отзывчивая версия
                // таблицы «сотрудники × дни месяца».
                path: 'work-schedule/today',
                element: <WorkScheduleTodayPage />,
            },
            {
                // Фаза 5 плана "Закрытие месяца и начисления" (docs/payroll-closing-and-accrual) —
                // список документов начисления закрытого месяца. Адрес с query
                // `?period=YYYY-MM&direction=` уже собирают переход после закрытия месяца и кнопка
                // «Начисления за {месяц}» на странице плана продаж (Фаза 4, useSalesPlanPage).
                path: 'salary-accruals',
                element: <SalaryAccrualsPage />,
            },
            {
                // Карточка документа начисления. Направление — query-параметр `?direction=`
                // (GET живёт под префиксом направления), а не сегмент пути — путь задан планом
                // Фазы 5 буквально как '/salary-accruals/:id'.
                path: 'salary-accruals/:id',
                element: <SalaryAccrualDocumentPage />,
            },
            {
                // Фаза 10 плана "Закрытие месяца и начисления" — сводка балансов по отделу
                // (пункт меню «Балансы», app/navigation.tsx). departmentId/period — query-
                // параметры (`?departmentId=&period=YYYY-MM`), тот же приём, что у
                // 'salary-accruals' с `?period=&direction=`.
                path: 'balance/department',
                element: <DepartmentBalancesPage />,
            },
            {
                // Баланс сотрудника — общий, без направления в пути (Фаза 8b: баланс живёт
                // под /v1/accounting/balance, вне /v1/service и /v1/shop). Открывается из
                // таблицы балансов отдела ("Открыть баланс") и, в будущем, из карточки
                // документа начисления.
                path: 'balance/employee/:id',
                element: <EmployeeBalancePage />,
            },
            {
                path: 'salaries/rules',
                element: <SalaryRuleListPage />,
            },
            {
                path: 'salaries/rules/new',
                element: <SalaryRulesPage />,
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
            },
            // Раздел «Настройки» (см. `app/navigation.tsx`, секция «Настройки»). Вложенный путь
            // задаётся одной строкой без ведущего слэша — отдельный layout-роут для `/settings`
            // не нужен, пока в разделе одна страница.
            {
                path: 'settings/employee-identity',
                element: <EmployeeIdentityPage />,
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
])
