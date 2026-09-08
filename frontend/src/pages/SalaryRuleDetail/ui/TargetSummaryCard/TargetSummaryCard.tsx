import { Building2, UserRound } from 'lucide-react'

import { pluralizeRules, SchemaNameField } from '@/features/SalaryRuleForm'

export type TargetSummaryCardProps = {
    direction: 'service' | 'shop'
    targetType: 'Department' | 'Employee'
    targetName: string
    schemaName: string
    onSchemaNameChange: (name: string) => void
    ruleCount: number
    className?: string
}

const DIRECTION_BADGE: Record<TargetSummaryCardProps['direction'], { label: string; className: string }> = {
    service: { label: 'Сервис', className: 'bg-brand-soft text-ok-ink' },
    shop: { label: 'Магазин', className: 'bg-info-soft text-info-ink' },
}

/**
 * Read-only вариант `pages/SalaryRules/ui/TargetCard` для редактирования (Pencil: node `AJpBQ`
 * "Схема начисления · Редактирование (Десктоп)" / `nhqIA` мобильный — "Карточка · Цель", eyebrow
 * «ЦЕЛЬ НАЧИСЛЕНИЯ», заголовок «Цель начисления», подзаголовок «Кому начисляется зарплата по этой
 * схеме»): направление и цель (Отдел/Сотрудник) показаны текстом без селектов — они заданы
 * маршрутом/схемой и на редактировании не меняются (см. apiDesign плана: `PATCH` принимает только
 * `{name, rules}`, без `targetType`/`targetId`). Единственное editable поле — название схемы
 * (`SchemaNameField`, переиспользована из `@/features/SalaryRuleForm`, см. `fsdDecisions`).
 */
export function TargetSummaryCard({
    direction,
    targetType,
    targetName,
    schemaName,
    onSchemaNameChange,
    ruleCount,
    className,
}: TargetSummaryCardProps) {
    const TargetIcon = targetType === 'Department' ? Building2 : UserRound
    const targetPrefix = targetType === 'Department' ? 'Отдел' : 'Сотрудник'
    const badge = DIRECTION_BADGE[direction]

    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-0 rounded-[12px] border border-hairline bg-surface">
                <div className="flex flex-col gap-2.5 border-b border-hairline p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-ui text-[10px] font-semibold tracking-[0.8px] text-ink-muted">
                            ЦЕЛЬ НАЧИСЛЕНИЯ
                        </span>
                        <span
                            className={`rounded-[6px] px-2 py-[3px] font-ui text-[11px] font-semibold ${badge.className}`}
                        >
                            {badge.label}
                        </span>
                    </div>
                    <div className="flex flex-col gap-[3px]">
                        <h2 className="font-display text-[17px] font-bold text-ink">Цель начисления</h2>
                        <p className="font-ui text-xs text-ink-muted">Кому начисляется зарплата по этой схеме</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3.5 p-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="font-ui text-xs font-medium text-ink-muted">{targetPrefix}</span>
                        <div className="flex h-9 items-center gap-2 rounded-[8px] border border-hairline bg-canvas px-3">
                            <TargetIcon className="size-[15px] shrink-0 text-ink-muted" />
                            <span className="truncate font-ui text-[13px] font-medium text-ink">{targetName}</span>
                        </div>
                    </div>

                    <SchemaNameField schemaName={schemaName} onSchemaNameChange={onSchemaNameChange} />
                </div>

                <div className="flex items-center gap-2.5 border-t border-hairline p-4">
                    <span className="font-ui text-[13px] font-semibold text-ink">
                        {pluralizeRules(ruleCount)} в схеме
                    </span>
                </div>
            </div>
        </div>
    )
}
