import { useEffect, useRef, useState } from 'react'

export function useDebounce<T>(value: T, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value)
    const isFirstRender = useRef(true)

    useEffect(() => {
        const timeout = isFirstRender.current ? 0 : delay
        isFirstRender.current = false
        const timer = setTimeout(() => setDebouncedValue(value), timeout)
        return () => clearTimeout(timer)
    }, [value, delay])

    const isDebouncing = value !== debouncedValue

    return { debouncedValue, isDebouncing }
}
