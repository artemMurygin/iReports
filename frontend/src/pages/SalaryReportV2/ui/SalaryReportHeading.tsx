import { employeeInitials } from '@/features/SalaryAccruals'
import type { SalaryReportScope } from '@/features/SalaryReportData'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

export type SalaryReportHeadingProps = {
    scope: SalaryReportScope
    employeeName: string | null
    employeeDepartmentName: string | null
    isEmployeeIdentityLoading: boolean
}

/**
 * Весь заголовочный блок `PageHeader`'s `title`-слота для `/salaries` — сама решает, что показать
 * (`frontend/CLAUDE.md`'s «медиатор без тернарников», ветвление живёт здесь, а не в
 * `SalaryReportV2Page`): в режиме "Отдел" — обычный текстовый заголовок/подзаголовок (то же самое,
 * что раньше передавалось напрямую в `title`/`subtitle`), в режиме "Сотрудник" — составной бейдж
 * аватар + имя + отдел, по аналогии с шапкой документа начисления (Pencil: `u32Yp`/`w4Eby`,
 * `pages/SalaryAccrualDocument/ui/DocumentHeader.tsx` — тот же приём `Avatar size="lg"` +
 * `employeeInitials` + `font-display`-заголовок, без статус-бейджа "Черновик"/"Уволен" — у отчёта
 * сотрудника нет аналога статуса документа начисления).
 *
 * `subtitle`-проп `PageHeader` этой страницей больше не используется — оба варианта заголовка (в том
 * числе подзаголовок отдела) собраны здесь, чтобы решение "что показывать" не расходилось между
 * двумя отдельными пропами `PageHeader`.
 *
 * Имя/отдел сотрудника резолвятся в `useSalaryReportPage` из Bitrix-справочника (`employeeName`/
 * `employeeDepartmentName`, см. её комментарий) — контракт отчёта сотрудника их не отдаёт. Пока
 * справочник ещё не загрузился (`isEmployeeIdentityLoading`) — показывается skeleton-заглушка той же
 * формы (заливка `bg-hairline`, не `bg-canvas` — этот блок сидит прямо на фоне страницы `bg-canvas`
 * Layout'а, а не внутри `bg-surface`-карточки, как остальные skeleton'ы страницы, поэтому заливка тем
 * же токеном, что и фон, была бы не видна). Если справочник загрузился, а сотрудника с таким
 * `employeeId` в нём нет (устаревшая/битая прямая ссылка) — просто не показывается ни аватар, ни имя,
 * без бесконечного skeleton'а.
 */
export function SalaryReportHeading({
    scope,
    employeeName,
    employeeDepartmentName,
    isEmployeeIdentityLoading,
}: SalaryReportHeadingProps) {
    if (scope !== 'employee') {
        return (
            <div className="flex flex-col gap-1">
                <span className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">Зарплата сотрудников</span>
                <span className="font-ui text-[14px] font-normal text-ink-muted">
                    Факт и прогноз начислений за период — по сотрудникам всех направлений
                </span>
            </div>
        )
    }

    if (isEmployeeIdentityLoading) {
        return (
            <div className="flex items-center gap-3.5" aria-hidden>
                <div className="size-10 shrink-0 animate-pulse rounded-full bg-hairline" />
                <div className="flex flex-col gap-1.5">
                    <div className="h-6 w-40 animate-pulse rounded bg-hairline" />
                    <div className="h-3.5 w-24 animate-pulse rounded bg-hairline" />
                </div>
            </div>
        )
    }

    if (employeeName == null) {
        return <span>Отчёт по зарплате</span>
    }

    return (
        <div className="flex items-center gap-3.5">
            <Avatar size="lg">
                <AvatarFallback>{employeeInitials(employeeName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate">{employeeName}</span>
                {employeeDepartmentName && (
                    <span className="truncate font-ui text-[13px] font-normal text-ink-muted">
                        {employeeDepartmentName}
                    </span>
                )}
            </div>
        </div>
    )
}
