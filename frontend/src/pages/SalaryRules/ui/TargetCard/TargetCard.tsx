import type { TargetOption } from '@/features/TargetDirectory'
import { SchemaNameField } from '@/features/SalaryRuleForm'

import type { SchemaDirection, TargetType } from '../../model/types.ts'

import { DirectionField } from './ui/DirectionField.tsx'
import { TargetCardFooter } from './ui/TargetCardFooter.tsx'
import { TargetCardHeader } from './ui/TargetCardHeader.tsx'
import { TargetSelectField } from './ui/TargetSelectField.tsx'
import { TargetTypeField } from './ui/TargetTypeField.tsx'

export type TargetCardProps = {
    direction: SchemaDirection
    onDirectionChange: (direction: SchemaDirection) => void
    targetType: TargetType
    onTargetTypeChange: (targetType: TargetType) => void
    targetId: number | null
    onTargetIdChange: (targetId: number) => void
    targetOptions: TargetOption[]
    isTargetOptionsLoading: boolean
    targetOptionsError?: string | null
    schemaName: string
    onSchemaNameChange: (name: string) => void
    /** Step 2's current draft count — only read to render the mobile-only "В схеме N правил"
     * connector footer (node `MMh80`, см. `ui/TargetCardFooter.tsx`), never used for any decision
     * here. */
    ruleCount: number
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → `Колонка · Схема` → `Карточка ·
 * Схема` — Шаг 1 "Кому начисляем": направление, цель начисления (Отдел/Сотрудник), зависимый
 * select (отдел или сотрудник — какой из двух решает `targetType`, см. `model/useSchemaTarget.ts`),
 * и название схемы. Presentational — все значения и колбэки приходят через props, состояние Шага 1
 * живёт в `model/useSchemaTarget.ts`, а собирает их вместе `model/useSalaryRulesPage.ts`.
 *
 * Фаза 5 (mobile adaptive): nodes `IScAL`/`AmfHy` add two mobile-only (`md:hidden`) touches to this
 * same card — a small green "обязательно" badge next to the "ШАГ 1" eyebrow (`ui/TargetCardHeader`)
 * and a footer strip (node `MMh80`, `ui/TargetCardFooter`) that reads the Step 2 rule count
 * (`ruleCount`) and points down to it ("Список — ниже"), replacing the visual continuity a
 * two-column desktop layout gets for free. Neither adds new state — `ruleCount` is just the rule
 * list's own `drafts.length`, threaded through by `model/useSalaryRulesPage.ts`.
 */
export function TargetCard({
    direction,
    onDirectionChange,
    targetType,
    onTargetTypeChange,
    targetId,
    onTargetIdChange,
    targetOptions,
    isTargetOptionsLoading,
    targetOptionsError,
    schemaName,
    onSchemaNameChange,
    ruleCount,
    className,
}: TargetCardProps) {
    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-0 rounded-[12px] border border-hairline bg-surface">
                <TargetCardHeader />

                <div className="flex flex-col gap-3.5 p-4">
                    <DirectionField direction={direction} onDirectionChange={onDirectionChange} />

                    <TargetTypeField targetType={targetType} onTargetTypeChange={onTargetTypeChange} />

                    <TargetSelectField
                        targetType={targetType}
                        targetId={targetId}
                        onTargetIdChange={onTargetIdChange}
                        targetOptions={targetOptions}
                        isTargetOptionsLoading={isTargetOptionsLoading}
                        targetOptionsError={targetOptionsError}
                    />

                    <SchemaNameField schemaName={schemaName} onSchemaNameChange={onSchemaNameChange} />
                </div>

                <TargetCardFooter ruleCount={ruleCount} />
            </div>
        </div>
    )
}
