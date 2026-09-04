import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Switch } from '@/shared/ui-kit/atoms/Switch'

import type { ServiceAccountRow } from '../model/useServiceAccountsPage.ts'

export type ServiceAccountsRowProps = {
    row: ServiceAccountRow
    /** `true`, пока идёт собственная мутация ЭТОЙ строки — блокирует переключатель на время запроса. */
    isPending: boolean
    onToggle: (employeeId: number, employeeName: string, nextIsServiceAccount: boolean) => void
}

/**
 * Строка списка «Служебные аккаунты» (docs/employee-ordering-and-salary-filter, Фаза 4) —
 * аватар с инициалами, имя/отдел, справа переключатель «Исключить из зарплаты» + подпись
 * текущего состояния. Своего макета в Pencil нет — вёрстка по образцу
 * `pages/EmployeeIdentity/ui/IdentityTableRow.tsx` (тот же приём: аватар + имя/отдел слева).
 */
function ServiceAccountsRow({ row, isPending, onToggle }: ServiceAccountsRowProps) {
    const { employee, departmentName, initials } = row
    const isExcluded = employee.isServiceAccount

    return (
        <div
            data-slot="service-accounts-row"
            className="flex min-h-[64px] items-center justify-between gap-3 border-b border-hairline bg-surface px-3.5 py-2.5 last:border-b-0"
        >
            <div className="flex min-w-0 items-center gap-[11px]">
                <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                    <span className="truncate font-ui text-sm font-medium text-ink">{employee.name}</span>
                    <span className="truncate font-ui text-xs text-ink-muted">{departmentName}</span>
                </div>
            </div>

            <label className="flex shrink-0 items-center gap-2.5">
                <span className={cn('hidden font-ui text-xs sm:inline', isExcluded ? 'text-ink' : 'text-ink-muted')}>
                    {isExcluded ? 'Исключён из зарплаты' : 'Учитывается в зарплате'}
                </span>
                <Switch
                    checked={isExcluded}
                    disabled={isPending}
                    onCheckedChange={(next) => onToggle(employee.id, employee.name, next)}
                    aria-label={`Исключить «${employee.name}» из зарплаты`}
                />
            </label>
        </div>
    )
}

export { ServiceAccountsRow }
