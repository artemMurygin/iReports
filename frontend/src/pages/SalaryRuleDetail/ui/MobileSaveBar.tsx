import { Check, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type MobileSaveBarProps = {
    onSave: () => void
    canSave: boolean
    isSubmitting: boolean
    className?: string
}

/**
 * Локальный аналог `pages/SalaryRules/ui/MobileSaveBar` — тот же sticky-паттерн (см. `mt-auto`+
 * "последний потомок `<main>`" в `Layout.tsx`, стик к `bottom-0`), но "Отмена" здесь — обычная
 * ссылка "Назад к списку" (не сброс Шага 1, которого на редактировании просто нет, цель схемы
 * неизменяема).
 */
export function MobileSaveBar({ onSave, canSave, isSubmitting, className }: MobileSaveBarProps) {
    return (
        <div
            data-slot="salary-rule-edit-mobile-save-bar"
            className={cn(
                'flex items-center gap-2.5 border-t border-hairline bg-surface px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]',
                className,
            )}
        >
            <Button asChild type="button" variant="secondary">
                <Link to="/salaries/rules">Назад</Link>
            </Button>
            <Button type="button" onClick={onSave} disabled={!canSave} className="flex-1">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Check />}
                Сохранить изменения
            </Button>
        </div>
    )
}
