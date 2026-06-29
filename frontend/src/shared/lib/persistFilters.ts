export function saveFilters<T>(key: string, filters: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(filters))
    } catch {
        // ignore QuotaExceededError
    }
}

export function loadFilters<T>(
    key: string,
    defaultValue: T,
    revive: (parsed: Record<string, unknown>) => T,
): T {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return defaultValue
        return revive(JSON.parse(raw) as Record<string, unknown>)
    } catch {
        return defaultValue
    }
}

export function parseDate(value: unknown): Date | undefined {
    if (!value) return undefined
    const d = new Date(value as string)
    return isNaN(d.getTime()) ? undefined : d
}
