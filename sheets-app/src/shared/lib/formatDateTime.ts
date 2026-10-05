/** Human-readable ru-RU date and time of a run, e.g. «5 октября 2026 г., 11:25». */
export function formatDateTime(epoch: number): string {
    return new Date(epoch).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}
