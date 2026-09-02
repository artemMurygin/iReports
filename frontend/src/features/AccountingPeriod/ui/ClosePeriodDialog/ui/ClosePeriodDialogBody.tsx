import { CircleCheck, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import type { ClosePeriodPreviewResponse, SalesDirection } from 'ireports-contracts'

import { formatCurrency, formatPeriodLabel } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'

import { DIRECTION_ERP_FROM } from '../../../model/labels.ts'
import type { CloseDialogState } from '../model/dialogState.ts'
import { CloseDialogKpiGrid } from './CloseDialogKpiGrid.tsx'
import { DialogAlert } from './DialogAlert.tsx'
import { UnapprovedRowsList, type UnapprovedRowDetails } from './UnapprovedRowsList.tsx'
import { UnclosedTaskRulesList } from './UnclosedTaskRulesList.tsx'

export type ClosePeriodDialogBodyProps = {
    state: CloseDialogState
    preview: ClosePeriodPreviewResponse | undefined
    direction: SalesDirection
    period: string
    rowDetailsById: Record<string, UnapprovedRowDetails>
    departmentNameById: Record<number, string>
    employeeNameById: Record<number, string>
    onApproveRow: (id: string) => void
    isApproving: boolean
    onRetryClose: () => void
    onRetryPreview: () => void
}

/**
 * Презентационное тело диалога закрытия — все ветвления состояний (Pencil `GUo20`
 * готово / `KPPJ5` заблокировано / `hhWeF` ошибка ERP / `xL1JD` выполняется) живут
 * здесь, а не в собирающем `ClosePeriodDialog` (конвенция «медиатор без условного
 * рендера», frontend/CLAUDE.md). В состоянии ошибки ERP перечень строк скрыт —
 * как в `hhWeF`, красный alert с «Повторить» занимает его место.
 */
function ClosePeriodDialogBody({
    state,
    preview,
    direction,
    period,
    rowDetailsById,
    departmentNameById,
    employeeNameById,
    onApproveRow,
    isApproving,
    onRetryClose,
    onRetryPreview,
}: ClosePeriodDialogBodyProps) {
    if (state.status === 'loading') {
        return (
            <div className="grid grid-cols-2 gap-3" aria-busy="true">
                {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="h-[108px] animate-pulse rounded-xl border border-hairline bg-canvas" />
                ))}
            </div>
        )
    }

    if (state.status === 'preview-error' || preview === undefined) {
        return (
            <DialogAlert
                tone="danger"
                icon={<TriangleAlert />}
                title="Не удалось загрузить сводку закрытия"
                description={state.errorMessage ?? 'Попробуйте ещё раз.'}
                action={
                    <Button type="button" variant="secondary" onClick={onRetryPreview} className="max-sm:w-full">
                        <RefreshCw />
                        Повторить
                    </Button>
                }
            />
        )
    }

    const showRowsList = state.unapprovedRows.length > 0 && state.status !== 'erp-error'
    const showUnclosedTaskRules = preview.unclosedTaskRules.length > 0 && state.status !== 'erp-error'

    return (
        <div className="flex flex-col gap-4">
            <CloseDialogKpiGrid preview={preview} />

            {showRowsList && (
                <UnapprovedRowsList
                    rows={state.unapprovedRows}
                    period={period}
                    rowDetailsById={rowDetailsById}
                    departmentNameById={departmentNameById}
                    onApproveRow={onApproveRow}
                    isApproving={isApproving}
                />
            )}

            {showUnclosedTaskRules && (
                <UnclosedTaskRulesList rules={preview.unclosedTaskRules} employeeNameById={employeeNameById} />
            )}

            {state.status === 'ready' && (
                <DialogAlert
                    tone="ok"
                    icon={<CircleCheck />}
                    title="Проверки пройдены — месяц можно закрывать"
                    description={`Будет создано ${preview.employeesCount} документов начисления на ${formatCurrency(preview.totalAmount)}. График работы за период будет нельзя редактировать.`}
                />
            )}

            {state.status === 'blocked' && (
                <DialogAlert
                    tone="warn"
                    icon={<TriangleAlert />}
                    title="Закрытие недоступно: есть неутверждённые строки плана"
                    description="Утвердите строки выше — после этого кнопка «Закрыть месяц» станет активной."
                />
            )}

            {state.status === 'closing' && (
                <DialogAlert
                    tone="info"
                    icon={<RefreshCw className="animate-spin" />}
                    title={`Синхронизируем данные ${DIRECTION_ERP_FROM[direction]}…`}
                    description={`Дотягиваем ${direction === 'shop' ? 'отгрузки' : 'заказы'} за ${formatPeriodLabel(period)}, затем фиксируем снапшот и создаём документы. Не закрывайте окно.`}
                />
            )}

            {state.status === 'erp-error' && (
                <DialogAlert
                    tone="danger"
                    icon={<WifiOff />}
                    title="Не удалось получить данные из ERP, повторите позже"
                    description={
                        (state.erpReason !== null ? `${state.erpReason}. ` : '') +
                        'Период остался открытым, документы начисления не созданы.'
                    }
                    action={
                        <Button type="button" variant="secondary" onClick={onRetryClose} className="max-sm:w-full">
                            <RefreshCw />
                            Повторить
                        </Button>
                    }
                />
            )}

            {state.status === 'error' && (
                <DialogAlert
                    tone="danger"
                    icon={<TriangleAlert />}
                    title="Не удалось закрыть месяц"
                    description={state.errorMessage ?? 'Попробуйте ещё раз.'}
                />
            )}
        </div>
    )
}

export { ClosePeriodDialogBody }
