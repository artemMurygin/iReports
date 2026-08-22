import { Loader2, Lock } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

import type { CloseDialogStatus } from '../model/dialogState.ts'

const HINT_BY_STATUS: Record<CloseDialogStatus, string> = {
    loading: 'Переоткрыть месяц можно, пока ни один документ не начислен',
    ready: 'Переоткрыть месяц можно, пока ни один документ не начислен',
    blocked: 'Переоткрыть месяц можно, пока ни один документ не начислен',
    closing: 'Обычно занимает 10–40 секунд',
    'erp-error': 'Синхронизация запускается автоматически при закрытии месяца',
    'preview-error': 'Синхронизация запускается автоматически при закрытии месяца',
    error: 'Синхронизация запускается автоматически при закрытии месяца',
}

export type ClosePeriodDialogFooterProps = {
    status: CloseDialogStatus
    canSubmit: boolean
    onCancel: () => void
    onSubmit: () => void
}

/**
 * Футер диалога закрытия (Pencil `GUo20`/`xL1JD`): подсказка слева, «Отмена» +
 * primary «Закрыть месяц» справа; во время выполнения — спиннер «Закрываем месяц…»
 * и заблокированная «Отмена» (закрытие нельзя прервать с фронта).
 */
function ClosePeriodDialogFooter({ status, canSubmit, onCancel, onSubmit }: ClosePeriodDialogFooterProps) {
    const isClosing = status === 'closing'

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0 flex-1 basis-48 font-ui text-[13px] text-ink-muted max-sm:hidden">
                {HINT_BY_STATUS[status]}
            </span>
            <div className="flex shrink-0 items-center gap-2.5 max-sm:w-full">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isClosing}>
                    Отмена
                </Button>
                <Button type="button" onClick={onSubmit} disabled={!canSubmit} className="max-sm:flex-1">
                    {isClosing ? <Loader2 className="animate-spin" /> : <Lock />}
                    {isClosing ? 'Закрываем месяц…' : 'Закрыть месяц'}
                </Button>
            </div>
        </div>
    )
}

export { ClosePeriodDialogFooter }
