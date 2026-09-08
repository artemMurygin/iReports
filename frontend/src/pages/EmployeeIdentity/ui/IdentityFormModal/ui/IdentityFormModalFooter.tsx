import { Check, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

type Props = {
    isEditing: boolean
    isSaving: boolean
    onCancel: () => void
    onSave: () => void
    onDelete: () => void
}

/**
 * Футер модалки связи (Pencil: фрейм `NjnJ3`): слева напоминание про расчёт зарплаты, справа
 * «Отмена» и «Сохранить связь».
 *
 * В режиме правки левую половину занимает «Удалить связь» — это единственная точка входа в
 * удаление (в таблице у чипа нет собственного меню, см. `IdentitySystemCell`), а напоминание
 * там менее полезно, чем действие. Само подтверждение открывается отдельной модалкой `CweSL`:
 * страница закрывает эту форму и открывает подтверждение, чтобы не вкладывать диалог в диалог.
 */
function IdentityFormModalFooter({ isEditing, isSaving, onCancel, onSave, onDelete }: Props) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            {isEditing ? (
                <Button type="button" variant="danger" onClick={onDelete} disabled={isSaving}>
                    <Trash2 />
                    Удалить связь
                </Button>
            ) : (
                <span className="font-ui text-xs text-ink-muted">Связь учитывается со следующего расчёта зарплаты</span>
            )}

            <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
                    Отмена
                </Button>
                <Button type="button" onClick={onSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                    Сохранить связь
                </Button>
            </div>
        </div>
    )
}

export { IdentityFormModalFooter }
