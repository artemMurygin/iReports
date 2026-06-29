import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { FunnelReportService } from '@/pages/FunnelReportService/FunnelReportService.tsx';
import { ServicesAnalytics } from '@/pages/ServicesAnalytics/ServicesAnalytics.tsx';


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
        ],
    },
])
