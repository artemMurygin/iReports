import { formatShortDate } from '@/shared/lib/format.ts'

/** "Обновлено 12 авг 2026" — schema card's meta row (Pencil `L5GclS` → `Meta Row` → `Updated`).
 * Date formatting itself lives in `shared/lib/format.ts`'s `formatShortDate` — see its comment
 * for why a fixed month table beats `Intl.DateTimeFormat` here. */
export function formatUpdatedAt(isoDate: string): string {
    return `Обновлено ${formatShortDate(isoDate)}`
}
