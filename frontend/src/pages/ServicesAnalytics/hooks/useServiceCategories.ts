import { useEffect, useState } from 'react'
import { api } from '@/shared/axios.instance'
import type { ServiceCategory } from '../types'

export function useServiceCategories() {
    const [categories, setCategories] = useState<ServiceCategory[]>([])

    useEffect(() => {
        api.get<ServiceCategory[]>('/reports/service-categories')
            .then((res) => setCategories(res.data))
            .catch(() => {})
    }, [])

    return { categories }
}
