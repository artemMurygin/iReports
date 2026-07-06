import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { FunnelReport } from '@/pages/FunnelReport'
import { ServicesAnalytics } from '@/pages/ServicesReport'
import { SalaryReport } from '@/pages/SalaryReport/SalaryReport.tsx'

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                index: true,
                element: <FunnelReport />,
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
