import { Loader2, TriangleAlert, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { identityFullLabel } from '../model/identityLabels.ts'
import type { DeleteTarget } from '../model/useEmployeeIdentityPage.ts'

export type DeleteIdentityModalProps = {
    /** `null` — модалка закрыта. */
    target: DeleteTarget | null
    isDeleting: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `CweSL` («Удалить связь?») — подтверждение
 * удаления шириной ~520px: подзаголовок с самой связью («RemOnline · ID · 412 — Артём
 * Мурыгин»), плашка последствий на `danger-soft` и пара кнопок.
 *
 * Подтверждение вынесено в отдельную модалку, а не в `window.confirm`, именно ради этой плашки:
 * последствие удаления (заказы выпадают из текущего расчёта) — не то, о чём можно спросить
 * одной строкой.
 *
 * Кнопка «Удалить связь» — залитая `danger` с белым текстом, как в макете; базовый вариант
 * `danger` у `Button` намеренно мягче (текст `danger` на `surface`), поэтому заливка
 * дописывается классами поверх варианта.
 */
function DeleteIdentityModal({ target, isDeleting, onOpenChange, onConfirm }: DeleteIdentityModalProps) {
    const footer = (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isDeleting}>
                Отмена
            </Button>
            <Button
                type="button"
                variant="danger"
                onClick={onConfirm}
                disabled={isDeleting}
                className="border-transparent bg-danger text-surface hover:bg-danger/90"
            >
                {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Удалить связь
            </Button>
        </div>
    )

    return (
        <Modal
            open={target !== null}
            onOpenChange={onOpenChange}
            className="sm:max-w-[520px]"
            title="Удалить связь?"
            subtitle={target ? identityFullLabel(target.identity, target.employeeName) : undefined}
            footer={footer}
        >
            <div className="flex gap-3 rounded-[10px] bg-danger-soft p-3.5">
                <TriangleAlert className="mt-[1px] size-[15px] shrink-0 text-danger" />
                <div className="flex flex-col gap-1">
                    <span className="font-ui text-[13px] font-semibold text-ink">
                        Заказы с этим ID выпадут из расчёта
                    </span>
                    <span className="font-ui text-xs text-ink-muted">
                        Зарплата сотрудника за текущий месяц пересчитается без них. Закрытые месяцы не изменятся.
                    </span>
                </div>
            </div>
        </Modal>
    )
}

export { DeleteIdentityModal }
