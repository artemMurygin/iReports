import { ListChecks } from 'lucide-react'

import { pluralizeRules } from '@/kernel/pluralizeRules.ts'

export type TargetCardFooterProps = {
    /** Текущее число черновиков Шага 2 — читается только ради этой подписи, ни на что не влияет. */
    ruleCount: number
}

/**
 * Мобильный (`md:hidden`) футер-коннектор карточки Шага 1 (Pencil, node `MMh80`, Фаза 5
 * docs/salary-schema-creation-ui): показывает, сколько правил уже в схеме, и указывает вниз, на
 * Шаг 2 ("Список — ниже") — так одноколоночная мобильная раскладка сохраняет визуальную связь,
 * которую десктопные две колонки дают даром.
 */
export function TargetCardFooter({ ruleCount }: TargetCardFooterProps) {
    return (
        <div className="flex items-center gap-2.5 border-t border-hairline p-4 md:hidden">
            <ListChecks className="size-4 shrink-0 text-ink-muted" />
            <div className="flex flex-col gap-0.5">
                <span className="font-ui text-[13px] font-semibold text-ink">
                    {ruleCount > 0 ? `В схеме ${pluralizeRules(ruleCount)} начисления` : 'В схеме пока нет правил'}
                </span>
                <span className="font-ui text-[11px] text-ink-muted">Список — ниже</span>
            </div>
        </div>
    )
}
