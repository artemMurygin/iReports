import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { FunnelReport } from '@/pages/FunnelReport'
import { ServicesAnalytics } from '@/pages/ServicesReport'
import { SalaryReport } from '@/pages/SalaryReport/SalaryReport.tsx'
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
                path: 'salaries',
                element: <SalaryReport />,
            },
        ],
    },
])
