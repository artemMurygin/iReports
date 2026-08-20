import { Check, Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

type Props = {
    onCancel: () => void
    onSave: () => void
    canSave: boolean
    isSaving: boolean
}

/** `EditPlanModal`'s footer slot: hint text + Отмена/Сохранить actions. */
export function EditPlanModalFooter({ onCancel, onSave, canSave, isSaving }: Props) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-ui text-xs text-ink-muted">Изменения применятся после сохранения</span>
            <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
                    Отмена
                </Button>
                <Button type="button" onClick={onSave} disabled={!canSave}>
                    {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                    Сохранить план
                </Button>
            </div>
        </div>
    )
}
