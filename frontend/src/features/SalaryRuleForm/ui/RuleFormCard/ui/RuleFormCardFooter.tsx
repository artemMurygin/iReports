import { Check } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

export type RuleFormCardFooterProps = {
    /** `draft.confirmed` — от него зависит только текст подсказки слева. */
    confirmed: boolean
    onCancel: () => void
    onSave: () => void
}

/** Футер раскрытой карточки (Pencil node `F8JNuZ`): подсказка плюс «Отмена»/«Сохранить правило». */
export function RuleFormCardFooter({ confirmed, onCancel, onSave }: RuleFormCardFooterProps) {
    return (
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="font-ui text-[11px] leading-[1.35] text-ink-muted">
                {confirmed ? 'Изменения обновят правило в схеме.' : 'Правило добавится в список схемы.'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Отмена
                </Button>
                <Button type="button" onClick={onSave}>
                    <Check />
                    Сохранить правило
                </Button>
            </div>
        </div>
    )
}
