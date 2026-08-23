import { useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import type { SalaryAccrualLine, SalesDirection } from 'ireports-contracts'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

import { useAccrueLine, useUnaccrueLine } from '../model/useAccrualMutations.ts'

import { AdjustLineModal } from './AdjustLineModal.tsx'

export type AccrualLineActionsProps = {
    line: SalaryAccrualLine
    direction: SalesDirection
    accrualId: string
}

/**
 * Действия строки документа начисления (Pencil `jb7fL`, колонка «Действия», Фаза 9
 * docs/payroll-closing-and-accrual): `DRAFT` — «Начислить» (primary) + карандаш
 * «Корректировать» (открывает `AdjustLineModal`); `ACCRUED` — «Отменить начисление»
 * (`variant="danger"`, читается макетом как ghost с красным текстом — тот же `Button`
 * вариант, что кнопка «Переоткрыть месяц» в `ReopenPeriodDialog`). Confirm — не
 * `window.confirm` (в проекте так не принято), а двухфазная замена кнопки на пару
 * «Точно?» / «Отмена» прямо в ячейке: полноценная модалка на каждую строку списка была
 * бы избыточна для однострочного подтверждения без последствий вроде удаления связи
 * (см. `DeleteIdentityModal`, где модалка оправдана предупреждением о пересчёте).
 * `PAID` (или любой другой статус строки) сюда не доходит — вызывающая таблица/список
 * карточек решает видимость всей колонки по статусу ДОКУМЕНТА, а не строки.
 */
function AccrualLineActions({ line, direction, accrualId }: AccrualLineActionsProps) {
    const accrueLine = useAccrueLine(direction, accrualId)
    const unaccrueLine = useUnaccrueLine(direction, accrualId)
    const [isAdjustOpen, setAdjustOpen] = useState(false)
    const [isConfirmingUnaccrue, setConfirmingUnaccrue] = useState(false)

    if (line.status === 'DRAFT') {
        return (
            <>
                <Button
                    type="button"
                    size="sm"
                    onClick={() => accrueLine.mutate(line.id)}
                    disabled={accrueLine.isPending}
                >
                    {accrueLine.isPending && <Loader2 className="animate-spin" />}
                    Начислить
                </Button>
                <IconButton
                    type="button"
                    aria-label={`Скорректировать сумму строки «${line.name}»`}
                    onClick={() => setAdjustOpen(true)}
                >
                    <Pencil />
                </IconButton>
                <AdjustLineModal
                    open={isAdjustOpen}
                    onOpenChange={setAdjustOpen}
                    line={line}
                    direction={direction}
                    accrualId={accrualId}
                />
            </>
        )
    }

    if (line.status === 'ACCRUED') {
        if (isConfirmingUnaccrue) {
            return (
                <>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingUnaccrue(false)}
                        disabled={unaccrueLine.isPending}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => unaccrueLine.mutate(line.id, { onSettled: () => setConfirmingUnaccrue(false) })}
                        disabled={unaccrueLine.isPending}
                    >
                        {unaccrueLine.isPending && <Loader2 className="animate-spin" />}
                        Точно?
                    </Button>
                </>
            )
        }

        return (
            <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingUnaccrue(true)}>
                Отменить начисление
            </Button>
        )
    }

    return null
}

export { AccrualLineActions }
