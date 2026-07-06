import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            staleTime: 5 * 60 * 1000,
        },
    },
})

declare global {
    interface Window {
        __TANSTACK_QUERY_CLIENT__: import('@tanstack/query-core').QueryClient
    }
}

window.__TANSTACK_QUERY_CLIENT__ = queryClient
