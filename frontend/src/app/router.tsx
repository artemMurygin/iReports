import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
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
import { DepartmentBalancesPage } from '@/pages/DepartmentBalances'
import { PayoutPage } from '@/pages/Payout'
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
                // Отчёт по зарплате (Pencil: design/sallary-first-iteration.pen, `wLtzp`/`b63e8p`
                // "Зарплата сотрудника" + `wVa5g`/`z5BwMk` "Зарплата отдела", `pages/SalaryReportV2`
                // — исходный, ранее не переработанный дизайн этой страницы удалён вместе с роутом
                // `/salaries-v2`, по которому этот компонент временно жил рядом со старым для
                // сравнения). По умолчанию показывает отчёт отдела.
                path: 'salaries',
                element: <SalaryReportV2Page />,
            },
            {
                // Отчёт сотрудника — свой URL (тот же приём, что `balance/employee/:id` у баланса,
                // см. её комментарий чуть ниже): открывается кнопкой «Открыть отчёт» из строки
                // сотрудника в отчёте отдела (`DepartmentEmployeeGroupV2`) или напрямую по ссылке.
                // Тот же компонент `SalaryReportV2Page` — режим и выбранный сотрудник читаются из
                // `:employeeId` в `useSalaryReportPage` (см. её комментарий).
                path: 'salaries/employee/:employeeId',
                element: <SalaryReportV2Page />,
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
                // Фаза 14 плана "Закрытие месяца и начисления" (docs/payroll-closing-and-accrual,
                // PRD 3) — «Выплата зарплаты»: таблица сотрудников периода направления,
                // выплата одному/выбранным. `direction`/`period` — query-параметры, тот же
                // приём, что 'salary-accruals' (эндпоинты выплаты per-direction).
                path: 'payout',
                element: <PayoutPage />,
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
