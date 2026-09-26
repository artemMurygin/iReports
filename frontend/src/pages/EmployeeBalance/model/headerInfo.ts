/**
 * Шапка баланса сотрудника (Pencil `L73YCK`/`JTc29`, docs/employee-settlements-page-redesign,
 * Фаза 5): подпись под именем — «Отдел · Должность». Вынесено в чистую функцию
 * (frontend/CLAUDE.md: model/ui-разделение для логики с ветвлением), чтобы собрать строку можно
 * было юнит-тестами без рендера `BalanceHeader`.
 */

/** Собирает финальную подпись шапки из отдела/должности, пропуская пустые части —
 * `position` пока приходит `null` для всех сотрудников, пока не подтянута синхронизация
 * должности (см. комментарий у `BalanceSummaryEmployee.position` в contracts), поэтому ни один
 * сегмент не обязателен. `null` целиком — когда сегментов нет (страница тогда не рендерит `<p>`
 * подписи). */
export function buildHeaderSubtitle(parts: (string | null | undefined)[]): string | null {
    const filtered = parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    return filtered.length > 0 ? filtered.join(' · ') : null
}
