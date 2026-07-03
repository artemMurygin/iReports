import { createContext, useContext } from 'react'

interface ServiceDealsTableContextValue {
    openDeal: (id: number) => void
}

export const ServiceDealsTableContext = createContext<ServiceDealsTableContextValue | null>(null)

export function useServiceDealsTable() {
    const ctx = useContext(ServiceDealsTableContext)
    if (!ctx) throw new Error('useServiceDealsTable must be used within ServiceDealsTable')
    return ctx
}
