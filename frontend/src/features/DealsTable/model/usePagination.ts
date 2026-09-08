import { useState } from 'react'

const PAGE_SIZE = 10

export function usePagination<T>(items: T[]) {
    const [page, setPage] = useState(1)

    // Сброс на первую страницу при смене набора данных — паттерн «adjusting state
    // when a prop changes» из документации React (сравнение с прошлым рендером +
    // setState прямо в рендере) вместо setState внутри useEffect: эффект давал
    // лишний каскадный рендер и ошибку react-hooks/set-state-in-effect.
    const [prevItems, setPrevItems] = useState(items)
    if (prevItems !== items) {
        setPrevItems(items)
        setPage(1)
    }

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
    const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const rangeFrom = Math.min((page - 1) * PAGE_SIZE + 1, items.length)
    const rangeTo = Math.min(page * PAGE_SIZE, items.length)

    return { page, setPage, totalPages, paginated, rangeFrom, rangeTo }
}
