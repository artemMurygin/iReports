import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** Thin `useQuery` wrapper — same convention as `features/TargetDirectory`'s `useDepartments`/
 * `useEmployees`. Fetches and merges both directions' schema lists — see `model/api.ts`'s
 * `fetchMotivationSchemas`. */
export function useMotivationSchemas() {
    return useQuery(api.getMotivationSchemas())
}
