import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { FunnelReportService } from '@/pages/FunnelReport/FunnelReportService.tsx'
import { ServicesAnalytics } from '@/pages/ServicesReport/ServicesAnalytics.tsx'
import { SalaryReport } from '@/pages/SalaryReport/SalaryReport.tsx'

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                index: true,
                element: <FunnelReportService />,
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
