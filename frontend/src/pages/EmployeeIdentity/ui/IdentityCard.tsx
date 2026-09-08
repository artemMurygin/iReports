import { Ellipsis } from 'lucide-react'
import type { EmployeeIdentityResponse, ExternalSystem } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Divider } from '@/shared/ui-kit/atoms/Divider'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

import { SYSTEMS, SYSTEM_LABEL } from '../model/identityLabels.ts'
import type { EmployeeIdentityRow } from '../model/useEmployeeIdentities.ts'
import { IdentitySystemCell } from './IdentitySystemCell.tsx'

export type IdentityCardProps = {
    row: EmployeeIdentityRow
    onAddIdentity: (bitrixEmployeeId: number, system: ExternalSystem) => void
    onAddForEmployee: (bitrixEmployeeId: number) => void
    onEditIdentity: (identity: EmployeeIdentityResponse) => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `Tu1Fs` («Связи сотрудников · Мобильный») —
 * та же строка таблицы, свёрнутая в карточку: шапка с аватаром, разделитель и по блоку на
 * каждую внешнюю систему (подпись системы + чипы столбиком).
 *
 * Ячейки систем — тот же `IdentitySystemCell`, что и в десктопной таблице, только `layout="stack"`.
 */
function IdentityCard({ row, onAddIdentity, onAddForEmployee, onEditIdentity, className }: IdentityCardProps) {
    const { employee, departmentName, initials, identitiesBySystem } = row

    return (
        <article
            data-slot="identity-card"
            className={cn('flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-3.5 font-ui', className)}
        >
            <div className="flex items-center gap-[11px]">
                <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-ui text-sm font-medium text-ink">{employee.name}</span>
                    <span className="truncate font-ui text-xs text-ink-muted">{departmentName}</span>
                </div>
                <IconButton
                    onClick={() => onAddForEmployee(employee.id)}
                    aria-label={`Добавить связь сотруднику ${employee.name}`}
                >
                    <Ellipsis />
                </IconButton>
            </div>

            <Divider orientation="horizontal" />

            <div className="flex flex-col gap-3">
                {SYSTEMS.map((system) => (
                    <div key={system} className="flex flex-col gap-1.5">
                        <span className="font-ui text-[11px] font-semibold text-ink-muted">{SYSTEM_LABEL[system]}</span>
                        <IdentitySystemCell
                            system={system}
                            employeeName={employee.name}
                            identities={identitiesBySystem[system]}
                            onAdd={() => onAddIdentity(employee.id, system)}
                            onEdit={onEditIdentity}
                            layout="stack"
                        />
                    </div>
                ))}
            </div>
        </article>
    )
}

export { IdentityCard }
