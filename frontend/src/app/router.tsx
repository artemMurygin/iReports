import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { FunnelReport } from '@/pages/FunnelReport'
import { ServicesAnalytics } from '@/pages/ServicesReport'
import { SalesPlanPage } from '@/pages/SalesPlan'
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
