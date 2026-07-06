export function parseDate(value: unknown): Date | undefined {
    if (!value) return undefined
    const d = new Date(value as string)
    return isNaN(d.getTime()) ? undefined : d
}
