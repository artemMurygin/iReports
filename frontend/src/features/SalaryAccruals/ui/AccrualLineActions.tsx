import { useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import type { SalaryAccrualLine, SalesDirection } from 'ireports-contracts'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

import { useAccrueLine, useUnaccrueLine } from '../model/useAccrualMutations.ts'

import { AdjustLineModal } from './AdjustLineModal.tsx'
import { SetTaskRewardModal } from './SetTaskRewardModal.tsx'

export type AccrualLineActionsProps = {
    line: SalaryAccrualLine
    direction: SalesDirection
    accrualId: string
}

/**
 * Действия строки документа начисления (Pencil `jb7fL`, колонка «Действия», Фаза 9
 * docs/payroll-closing-and-accrual): `DRAFT` — «Начислить» (primary, только когда
 * `line.amount > 0` — начислять нулевую сумму не имеет смысла, см. ниже) + карандаш
 * «Корректировать» (по прямому запросу пользователя — тот же карандаш у ЛЮБОЙ `DRAFT`-строки,
 * включая строки задач, а не отдельная единственная кнопка «Указать сумму» только у них);
 * `ACCRUED` — «Отменить начисление» (`variant="danger"`, читается макетом как ghost с красным
 * текстом — тот же `Button` вариант, что кнопка «Переоткрыть месяц» в `ReopenPeriodDialog`).
 * Бьёт напрямую, без подтверждения (по прямому запросу пользователя) — действие обратимо
 * (строка возвращается в `DRAFT`, начислить её можно повторно).
 * `PAID` (или любой другой статус строки) сюда не доходит — вызывающая таблица/список
 * карточек решает видимость всей колонки по статусу ДОКУМЕНТА, а не строки.
 *
 * `requiresManualInput === true` (add-task-based-salary-rule, раздел 24, design.md
 * Decision 5) — строка правила «за выполнение задачи» с ещё не заданной суммой
 * (`originalAmount`/`amount` = 0, отсюда и `canAccrue === false` для неё — то же правило
 * «нулю нечего начислять», а не отдельный спецкейс). Карандаш открывает `SetTaskRewardModal`
 * (PATCH .../task-reward) вместо `AdjustLineModal` — начислять нулевую сумму до того, как
 * руководитель её ввёл, бэкенд всё равно отклонит (spec service/accounting: «проведение
 * отклоняется, пока комментарий не указан»), поэтому кнопки «Начислить» здесь и не будет, пока
 * сумма не задана; после сохранения `requiresManualInput` сбрасывается бэкендом, и строка на
 * следующем рефетче попадает в обычную ветку ниже с уже ненулевой суммой.
 */
function AccrualLineActions({ line, direction, accrualId }: AccrualLineActionsProps) {
    const accrueLine = useAccrueLine(direction, accrualId)
    const unaccrueLine = useUnaccrueLine(direction, accrualId)
    const [isAdjustOpen, setAdjustOpen] = useState(false)
    const [isTaskRewardOpen, setTaskRewardOpen] = useState(false)

    if (line.status === 'DRAFT') {
        const canAccrue = line.amount > 0

        return (
            <>
                {canAccrue && (
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => accrueLine.mutate(line.id)}
                        disabled={accrueLine.isPending}
                    >
                        {accrueLine.isPending && <Loader2 className="animate-spin" />}
                        Начислить
                    </Button>
                )}
                <IconButton
                    type="button"
                    aria-label={
                        line.requiresManualInput
                            ? `Указать сумму строки «${line.name}»`
                            : `Скорректировать сумму строки «${line.name}»`
                    }
                    onClick={() => (line.requiresManualInput ? setTaskRewardOpen(true) : setAdjustOpen(true))}
                >
                    <Pencil />
                </IconButton>
                {line.requiresManualInput ? (
                    <SetTaskRewardModal
                        open={isTaskRewardOpen}
                        onOpenChange={setTaskRewardOpen}
                        line={line}
                        direction={direction}
                        accrualId={accrualId}
                    />
                ) : (
                    <AdjustLineModal
                        open={isAdjustOpen}
                        onOpenChange={setAdjustOpen}
                        line={line}
                        direction={direction}
                        accrualId={accrualId}
                    />
                )}
            </>
        )
    }

    if (line.status === 'ACCRUED') {
        return (
            <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => unaccrueLine.mutate(line.id)}
                disabled={unaccrueLine.isPending}
            >
                {unaccrueLine.isPending && <Loader2 className="animate-spin" />}
                Отменить начисление
            </Button>
        )
    }

    return null
}

export { AccrualLineActions }
