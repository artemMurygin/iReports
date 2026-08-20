import { Check, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

export type PageHeaderProps = {
    schemaName: string
    onSave: () => void
    canSave: boolean
    isSubmitting: boolean
}

const BREADCRUMBS = [{ label: 'Зарплата' }, { label: 'Правила начисления' }]

/**
 * Локальный аналог `pages/SalaryRules/ui/PageHeader` — заголовок = название редактируемой схемы
 * (а не статичное "Новая зарплатная схема"), плюс хлебная крошка с текущим названием третьим
 * пунктом (десктоп) — того же вида, что `ERP/Organism/Page Header`'s `Breadcrumbs` в остальных
 * списковых страницах (`shared/ui-kit/organisms/PageHeader.tsx`), но переписана вручную здесь,
 * т.к. тот компонент не поддерживает кнопку-действие рядом с заголовком в нужной раскладке
 * ("Сохранить" — единственная кнопка справа, без вторичной).
 */
export function PageHeader({ schemaName, onSave, canSave, isSubmitting }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-3">
            <div className="hidden items-center gap-1.5 md:flex">
                {BREADCRUMBS.map((crumb) => (
                    <span key={crumb.label} className="flex items-center gap-1.5">
                        <span className="font-ui text-xs text-ink-muted">{crumb.label}</span>
                        <ChevronRight className="size-3 shrink-0 text-ink-faint" />
                    </span>
                ))}
                <span className="truncate font-ui text-xs font-medium text-ink">{schemaName || 'Схема'}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[20px] font-bold tracking-[-0.3px] text-ink">
                        {schemaName || 'Схема начисления'}
                    </h1>
                    <p className="font-ui text-[13px] text-ink-muted">
                        Изменения применяются целиком: название и весь список правил направления.
                    </p>
                </div>

                <Button onClick={onSave} disabled={!canSave} className="hidden md:inline-flex">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Check />}
                    Сохранить изменения
                </Button>
            </div>
        </div>
    )
}
