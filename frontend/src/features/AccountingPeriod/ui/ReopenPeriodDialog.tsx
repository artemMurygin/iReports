import { useEffect } from 'react'
import { Loader2, RotateCcw, TriangleAlert } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import { formatPeriodLabel, formatPeriodMonthGenitive } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { classifyReopenPeriodError } from '../model/closePeriodErrors.ts'
import { ACCRUAL_STATUS_LABEL, DIRECTION_LABEL } from '../model/labels.ts'
import { useReopenPeriod } from '../model/usePeriodMutations.ts'

export type ReopenPeriodDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    direction: SalesDirection
    period: string
    /** ФИО сотрудника Bitrix по id — подписи перечня документов не в «Черновике». */
    employeeNameById?: Record<number, string>
}

const NO_EMPLOYEE_NAMES: Record<number, string> = {}

/**
 * Подтверждение «Переоткрыть месяц» (PRD 1: reopen — только с явным подтверждением;
 * для блока статуса см. Pencil `lu0Bl`, состояние B). Отдельного макета у этого окна
 * нет — собрано из тех же частей, что диалог закрытия (`Modal` `XttYX`, тот же
 * bottom-sheet на мобильном). Ошибка `409` с `metadata.accruals` (документы не в
 * «Черновике», см. salaryAccrualNotDraftRowSchema) разворачивается в перечень
 * «кто уже начислен» — переоткрытие возможно только после сторно начислений (PRD 2).
 */
function ReopenPeriodDialog({
    open,
    onOpenChange,
    direction,
    period,
    employeeNameById = NO_EMPLOYEE_NAMES,
}: ReopenPeriodDialogProps) {
    const reopenMutation = useReopenPeriod(direction, period)
    const { reset } = reopenMutation

    useEffect(() => {
        if (open) reset()
    }, [open, reset])

    const error = reopenMutation.error !== null ? classifyReopenPeriodError(reopenMutation.error) : null
    const isReopening = reopenMutation.isPending

    function handleOpenChange(next: boolean) {
        if (!next && isReopening) return
        onOpenChange(next)
    }

    function submit() {
        reopenMutation.mutate(undefined, { onSuccess: () => onOpenChange(false) })
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Переоткрыть ${formatPeriodLabel(period)} · ${DIRECTION_LABEL[direction]}`}
            subtitle="Снапшот периода и черновики документов начисления будут удалены"
            className="max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0"
            footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 basis-48 font-ui text-[13px] text-ink-muted max-sm:hidden">
                        Переоткрытие возможно, пока все документы в «Черновике»
                    </span>
                    <div className="flex shrink-0 items-center gap-2.5 max-sm:w-full">
                        <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isReopening}>
                            Отмена
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={submit}
                            disabled={isReopening}
                            className="max-sm:flex-1"
                        >
                            {isReopening ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                            {isReopening ? 'Переоткрываем…' : 'Переоткрыть месяц'}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="font-ui text-[13px] leading-relaxed text-ink">
                    План и факт снова будут считаться по текущим данным, часы {formatPeriodMonthGenitive(period)} станут
                    редактируемыми, а созданные при закрытии черновики документов начисления будут удалены. Месяц можно
                    будет закрыть заново.
                </p>

                {error !== null && error.kind === 'not-draft' && (
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                            <TriangleAlert className="mt-0.5 size-[18px] shrink-0" />
                            <div>
                                <p className="font-semibold">Переоткрыть нельзя — есть начисленные документы</p>
                                <p className="mt-0.5">
                                    Сначала отмените начисления по документам ниже, затем повторите переоткрытие.
                                </p>
                            </div>
                        </div>
                        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                            {error.accruals.map((accrual) => (
                                <li key={accrual.id} className="flex items-center gap-2.5 px-4 py-3">
                                    <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-semibold text-ink">
                                        {employeeNameById[accrual.employeeId] ?? `Сотрудник ${accrual.employeeId}`}
                                    </span>
                                    <span className="shrink-0 rounded-md bg-info-soft px-2 py-0.5 font-ui text-xs font-medium text-info-ink">
                                        {ACCRUAL_STATUS_LABEL[accrual.status]}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {error !== null && error.kind === 'unknown' && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                        <TriangleAlert className="mt-0.5 size-[18px] shrink-0" />
                        <div>
                            <p className="font-semibold">Не удалось переоткрыть месяц</p>
                            <p className="mt-0.5">{error.message}</p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export { ReopenPeriodDialog }
