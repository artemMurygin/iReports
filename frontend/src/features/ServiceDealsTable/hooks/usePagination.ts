import { useState, useEffect } from 'react'

const PAGE_SIZE = 10

export function usePagination<T>(items: T[]) {
    const [page, setPage] = useState(1)

    useEffect(() => { setPage(1) }, [items])

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
    const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const rangeFrom = Math.min((page - 1) * PAGE_SIZE + 1, items.length)
    const rangeTo = Math.min(page * PAGE_SIZE, items.length)

    return { page, setPage, totalPages, paginated, rangeFrom, rangeTo }
}