import type { SalesDirection } from 'ireports-contracts'

import { formatPeriodLabel } from '@/shared/lib/format.ts'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { DIRECTION_ERP_FROM, DIRECTION_LABEL } from '../../../model/labels.ts'
import { useClosePeriodDialog } from '../model/useClosePeriodDialog.ts'
import { ClosePeriodDialogBody } from './ClosePeriodDialogBody.tsx'
import { ClosePeriodDialogFooter } from './ClosePeriodDialogFooter.tsx'
import type { UnapprovedRowDetails } from './UnapprovedRowsList.tsx'

export type ClosePeriodDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    direction: SalesDirection
    period: string
    /** Название/сумма строки плана по id — обогащение перечня неутверждённых строк
     * данными страницы (сводка close-preview несёт только id/отдел/категорию). */
    rowDetailsById?: Record<string, UnapprovedRowDetails>
    /** Названия отделов Bitrix по id (справочник страницы). */
    departmentNameById?: Record<number, string>
    /** «Утвердить» у строки перечня — утверждение принадлежит фиче плана продаж,
     * поэтому приходит колбэком со страницы (кросс-импорты features запрещены). */
    onApproveRow?: (id: string) => void
    isApprovingRow?: boolean
    /** После успешного закрытия (страница переходит на список начислений). */
    onClosed?: () => void
}

const NO_ROW_DETAILS: Record<string, UnapprovedRowDetails> = {}
const NO_DEPARTMENT_NAMES: Record<number, string> = {}

/**
 * Окно подтверждения «Закрыть {месяц} · {направление}» (Pencil: `GUo20` готово,
 * `KPPJ5` заблокировано планом, `hhWeF` ошибка ERP, `xL1JD` выполняется; мобильные
 * bottom-sheet версии `o6vgAh`/`sAd8Z`/`L1OLgC`). Собран на ui-kit `Modal` (узел
 * `XttYX`) — на мобильном тот же Radix-контент прижимается к низу экрана
 * `max-md:`-классами (как контент `TargetFilterSheet`), отдельного компонента
 * bottom-sheet в ките нет. Весь стейт — в `useClosePeriodDialog`, все ветвления —
 * в `ClosePeriodDialogBody`.
 */
function ClosePeriodDialog({
    open,
    onOpenChange,
    direction,
    period,
    rowDetailsById = NO_ROW_DETAILS,
    departmentNameById = NO_DEPARTMENT_NAMES,
    onApproveRow,
    isApprovingRow = false,
    onClosed,
}: ClosePeriodDialogProps) {
    const { preview, state, submit, retryPreview } = useClosePeriodDialog({
        open,
        direction,
        period,
        onClosed: () => {
            onOpenChange(false)
            onClosed?.()
        },
    })

    function handleOpenChange(next: boolean) {
        // Пока идёт закрытие, окно не закрывается ни по оверлею, ни по Escape —
        // операция необратима с фронта, пользователь должен видеть её исход.
        if (!next && state.status === 'closing') return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Закрыть ${formatPeriodLabel(period)} · ${DIRECTION_LABEL[direction]}`}
            subtitle={`Финально выгружаем данные ${DIRECTION_ERP_FROM[direction]}, затем сохраняем отчеты по зарплате, они больше не будут пересчитываться`}
            className="md:max-w-[720px] max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0"
            footer={
                <ClosePeriodDialogFooter
                    status={state.status}
                    canSubmit={state.canSubmit}
                    onCancel={() => handleOpenChange(false)}
                    onSubmit={submit}
                />
            }
        >
            <ClosePeriodDialogBody
                state={state}
                preview={preview}
                direction={direction}
                period={period}
                rowDetailsById={rowDetailsById}
                departmentNameById={departmentNameById}
                onApproveRow={onApproveRow ?? (() => undefined)}
                isApproving={isApprovingRow}
                onRetryClose={submit}
                onRetryPreview={retryPreview}
            />
        </Modal>
    )
}

export { ClosePeriodDialog }
