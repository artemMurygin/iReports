/** Compact ru-RU date and time of a run, e.g. «5 окт в 16:27» (the year is added only for another year). */
export function formatDateTime(epoch: number): string {
    const date = new Date(epoch)
    const sameYear = date.getFullYear() === new Date().getFullYear()
    return date
        .toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            ...(sameYear ? {} : { year: 'numeric' }),
            hour: '2-digit',
            minute: '2-digit',
        })
        .replace('.', '')
        .replace(/ г\.?,/, ',')
        .replace(', ', ' в ')
}
