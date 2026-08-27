import type { EmployeeIdentityResponse, ExternalSystem } from 'ireports-contracts'

/**
 * Шапка баланса сотрудника (Pencil `L73YCK`/`JTc29`, docs/employee-settlements-page-redesign,
 * Фаза 5): подпись под именем — «Отдел · Должность · связан с <ERP-системами>». Вынесено в
 * чистые функции (frontend/CLAUDE.md: model/ui-разделение для логики с ветвлением), чтобы
 * собрать строку можно было юнит-тестами без рендера `BalanceHeader`.
 */

/** Творительный падеж («связан С ЧЕМ») — Pencil `L73YCK`: «связан с RemOnline и МойСкладом»,
 * не «...и МойСклад». `RemOnline` не склоняется (латиница), `МойСклад` — да. */
const SYSTEM_LABEL_INSTRUMENTAL: Record<ExternalSystem, string> = {
    ROAPP: 'RemOnline',
    MOY_SKLAD: 'МойСкладом',
}

/**
 * «связан с RemOnline и МойСкладом» / «связан с RemOnline» — из списка связей сотрудника
 * (`GET /v1/employee-identity/employee/:id`), без дублей систем (у сотрудника может быть
 * несколько идентификаторов в одной системе — например, `EMPLOYEE_ID` и
 * `ONLINE_MANAGER_FIELD` оба в RemOnline). `null`, если связей нет вовсе — шапка тогда просто
 * не показывает этот сегмент.
 */
export function buildErpLinkageLabel(identities: EmployeeIdentityResponse[]): string | null {
    const systems = Array.from(new Set(identities.map((identity) => identity.system)))
    if (systems.length === 0) return null

    const labels = systems.map((system) => SYSTEM_LABEL_INSTRUMENTAL[system])
    if (labels.length === 1) return `связан с ${labels[0]}`
    return `связан с ${labels.slice(0, -1).join(', ')} и ${labels[labels.length - 1]}`
}

/** Собирает финальную подпись шапки из отдела/должности/ERP-связки, пропуская пустые части —
 * `position` пока приходит `null` для всех сотрудников, пока не подтянута синхронизация
 * должности (см. комментарий у `BalanceSummaryEmployee.position` в contracts), а связей может
 * не быть вовсе, поэтому ни один сегмент не обязателен. `null` целиком — когда сегментов нет
 * (страница тогда не рендерит `<p>` подписи). */
export function buildHeaderSubtitle(parts: (string | null | undefined)[]): string | null {
    const filtered = parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    return filtered.length > 0 ? filtered.join(' · ') : null
}
