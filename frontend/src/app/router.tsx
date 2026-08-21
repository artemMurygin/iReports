import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { FunnelReport } from '@/pages/FunnelReport'
import { ServicesAnalytics } from '@/pages/ServicesReport'
import { SalesPlanPage } from '@/pages/SalesPlan'
import { SalaryRulesPage } from '@/pages/SalaryRules'
import { SalaryRuleListPage } from '@/pages/SalaryRuleList'
import { SalaryRuleDetailPage } from '@/pages/SalaryRuleDetail'
import { SalaryReportPage } from '@/pages/SalaryReport'
import { EmployeeIdentityPage } from '@/pages/EmployeeIdentity'
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
