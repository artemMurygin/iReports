import { Check, Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

export type PageHeaderProps = {
    onSave: () => void
    canSave: boolean
    isSubmitting: boolean
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → шапка страницы: заголовок
 * "Новая зарплатная схема", подзаголовок и десктопная кнопка "Сохранить схему".
 *
 * Фаза 5 (mobile adaptive, docs/salary-schema-creation-ui): ниже `md:` эта кнопка скрыта
 * (`hidden md:inline-flex`) — её место занимает sticky-бар `ui/MobileSaveBar`, который вызывает тот
 * же `onSave` с теми же `canSave`/`isSubmitting`.
 */
export function PageHeader({ onSave, canSave, isSubmitting }: PageHeaderProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-[20px] font-bold tracking-[-0.3px] text-ink">
                    Новая зарплатная схема
                </h1>
                <p className="font-ui text-[13px] text-ink-muted">
                    Схема определяет, кому начисляем, и содержит правила начисления.
                </p>
            </div>

            <Button onClick={onSave} disabled={!canSave} className="hidden md:inline-flex">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Check />}
                Сохранить схему
            </Button>
        </div>
    )
}
