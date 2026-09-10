import { Check, Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Breadcrumbs } from '@/shared/ui-kit/atoms/Breadcrumbs'

export type PageHeaderProps = {
    schemaName: string
    onSave: () => void
    canSave: boolean
    isSubmitting: boolean
}

const BREADCRUMBS = [{ label: 'Зарплата' }, { label: 'Правила начисления', to: '/salaries/rules' }]

/**
 * Локальный аналог `pages/SalaryRules/ui/PageHeader` — заголовок = название редактируемой схемы
 * (а не статичное "Новая зарплатная схема"), плюс хлебная крошка с текущим названием третьим
 * пунктом (десктоп) — того же вида и через тот же переиспользуемый `Breadcrumbs`
 * (`shared/ui-kit/atoms/Breadcrumbs`), что и `ERP/Organism/Page Header`'s `Breadcrumbs` в
 * остальных списковых страницах (`shared/ui-kit/organisms/PageHeader.tsx`), но заголовок
 * собран вручную здесь, т.к. тот компонент не поддерживает кнопку-действие рядом с заголовком в
 * нужной раскладке ("Сохранить" — единственная кнопка справа, без вторичной).
 */
export function PageHeader({ schemaName, onSave, canSave, isSubmitting }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-3">
            <Breadcrumbs items={[...BREADCRUMBS, { label: schemaName || 'Схема' }]} />

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
