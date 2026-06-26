export function getInitials(firstName: string, lastName: string) {
    return `${firstName[0]}${lastName[0]}`
}

export function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

export function formatAmount(amount: number | null) {
    if (amount === null) return '—'
    return `${amount.toLocaleString('ru-RU')} ₽`
}