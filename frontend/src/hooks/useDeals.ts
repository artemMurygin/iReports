import { useState, useEffect } from "react"
import { type DateRange } from "react-day-picker"
import { fetchDeals } from "@/api/deals"
import { type Deal } from "@/types/deal"
import { addHours } from 'date-fns';

interface UseDealsResult {
  deals: Deal[]
  loading: boolean
  error: string | null
}

export function useDeals(dateRange: DateRange): UseDealsResult {
    const { from, to } = dateRange

    const [deals, setDeals] = useState<Deal[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setLoading(true)
        setError(null)

        fetchDeals(addHours(from, 0), addHours(to, 23))
          .then((data) => setDeals(data.deals))
          .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"))
          .finally(() => setLoading(false))
    }, [dateRange])

    return { deals, loading, error }
}