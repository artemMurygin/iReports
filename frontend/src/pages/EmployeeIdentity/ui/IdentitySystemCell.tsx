import { Plus } from 'lucide-react'
import type { EmployeeIdentityResponse, ExternalSystem } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Chip } from '@/shared/ui-kit/atoms/Chip'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

import { IDENTITY_TYPE_ICON, SYSTEM_LABEL, identityChipLabel } from '../model/identityLabels.ts'

export type IdentitySystemCellProps = {
    system: ExternalSystem
    employeeName: string
    identities: EmployeeIdentityResponse[]
    onAdd: () => void
    onEdit: (identity: EmployeeIdentityResponse) => void
    /** `row` — ячейка таблицы (чипы в ряд), `stack` — мобильная карточка (чипы столбиком). */
    layout?: 'row' | 'stack'
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, фреймы `CpVvw` (ячейка системы в строке таблицы)
 * и `Tu1Fs` (тот же блок в мобильной карточке) — чипы идентификаторов сотрудника в одной
 * внешней системе плюс кнопка добавления, либо «призрачный» плейсхолдер «Связать», если связей
 * нет.
 *
 * Один компонент на оба макета: различается только направление раскладки чипов (в ряд против
 * столбика), поэтому это проп `layout`, а не вторая копия ячейки.
 *
 * Клик по чипу открывает правку этой связи — отдельной кнопки «изменить» в макете нет, а сам
 * чип и есть представление одной связи; удаление живёт в футере модалки правки (см.
 * `IdentityFormModal`), чтобы не заводить меню действий, которого в UI Kit пока нет.
 */
function IdentitySystemCell({
    system,
    employeeName,
    identities,
    onAdd,
    onEdit,
    layout = 'row',
    className,
}: IdentitySystemCellProps) {
    const systemLabel = SYSTEM_LABEL[system]

    if (identities.length === 0) {
        return (
            <div data-slot="identity-system-cell" className={cn('flex min-w-0 items-center', className)}>
                <Chip
                    variant="ghost"
                    icon={<Plus />}
                    onClick={onAdd}
                    aria-label={`Связать сотрудника ${employeeName} с системой ${systemLabel}`}
                >
                    Связать
                </Chip>
            </div>
        )
    }

    return (
        <div
            data-slot="identity-system-cell"
            className={cn(
                'flex min-w-0 gap-1.5',
                layout === 'row' ? 'flex-wrap items-center' : 'flex-col items-start',
                className,
            )}
        >
            {identities.map((identity) => {
                const Icon = IDENTITY_TYPE_ICON[identity.identifierType]
                const label = identityChipLabel(identity)

                return (
                    <Chip
                        key={identity.id}
                        icon={<Icon />}
                        onClick={() => onEdit(identity)}
                        title={`${systemLabel} · ${label}`}
                        aria-label={`Изменить связь ${systemLabel} · ${label}`}
                        className="max-w-full"
                    >
                        {label}
                    </Chip>
                )
            })}

            <IconButton
                size="sm"
                onClick={onAdd}
                className="text-ink-faint"
                aria-label={`Добавить ещё один идентификатор ${systemLabel} сотруднику ${employeeName}`}
            >
                <Plus />
            </IconButton>
        </div>
    )
}

export { IdentitySystemCell }
