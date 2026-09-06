import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import '../index.css'
import { router } from './router.tsx'
import { queryClient } from '@/shared/api/query-client.ts'
import { EmbeddedLoginBootstrap } from './EmbeddedLoginBootstrap.tsx'

createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
        <EmbeddedLoginBootstrap />
        <RouterProvider router={router} />
    </QueryClientProvider>,
)
