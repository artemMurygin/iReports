import { RadioCard } from '@/shared/ui-kit/atoms/RadioCard'

import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { AwardOptionConfig, RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { AwardKind, BorderDraft, RuleDraft } from '../../../model/ruleDraft.ts'
import { PercentSliderField } from '../../PercentSliderField'

import { AmountField } from './AmountField.tsx'
import { FieldError } from './FieldError.tsx'
import { FloatPercentFields } from './FloatPercentFields.tsx'
import { SalaryBasisField } from './SalaryBasisField.tsx'

export type AwardSectionProps = {
    draft: RuleDraft
    config: RuleFormConfig
    /** `config.awardOptionsByType[draft.type]` — считается в `model/useRuleFormCard.ts`. */
    awardOptions: AwardOptionConfig[]
    errors: RuleFieldErrors
    onChange: (patch: Partial<RuleDraft>) => void
    onChangeBorder: (index: number, patch: Partial<BorderDraft>) => void
    onAwardKindChange: (kind: AwardKind) => void
}

/**
 * Блок «Вариант награды» целиком: ряд `RadioCard` с доступными вариантами для текущего типа правила
 * плюс под-поля выбранного варианта — один визуальный блок, один файл, поэтому под-поля остаются
 * прямыми детьми колонки `flex flex-col gap-3.5`, а не отдельным компонентом-фрагментом.
 * `ServiceFixed` полей не имеет: сумма подставляется из карточки услуги в RemOnline.
 */
export function AwardSection({
    draft,
    config,
    awardOptions,
    errors,
    onChange,
    onChangeBorder,
    onAwardKindChange,
}: AwardSectionProps) {
    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
                <span className="font-ui text-xs font-medium text-ink-muted">Вариант награды</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {awardOptions.map((option) => (
                        <RadioCard
                            key={option.kind}
                            selected={draft.awardKind === option.kind}
                            onSelect={() => onAwardKindChange(option.kind)}
                            title={option.title}
                            description={option.description}
                        />
                    ))}
                </div>
                <FieldError message={errors.awardKind} />
            </div>

            {draft.awardKind === 'Fixed' && (
                <AmountField
                    label="Сумма, ₽"
                    value={draft.price}
                    placeholder="300"
                    error={errors.price}
                    onValueChange={(price) => onChange({ price })}
                />
            )}

            {draft.awardKind === 'ServiceFixed' && (
                <p className="font-ui text-xs text-ink-muted">
                    Сумма подставится автоматически из карточки услуги в RemOnline при расчёте — вводить ставку не
                    нужно.
                </p>
            )}

            {draft.awardKind === 'ServicePercent' && (
                <PercentSliderField
                    className="max-w-[320px]"
                    label="Процент от стоимости услуги"
                    value={draft.percent}
                    onValueChange={(value) => onChange({ percent: value })}
                />
            )}
            {draft.awardKind === 'ServicePercent' && <FieldError className="-mt-2" message={errors.percent} />}

            {draft.awardKind === 'FixedPercent' && (
                <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:gap-6">
                    <PercentSliderField
                        className="max-w-[320px]"
                        label="Процент"
                        value={draft.percent}
                        onValueChange={(value) => onChange({ percent: value })}
                    />
                    <SalaryBasisField
                        options={config.salaryBasisOptions}
                        value={draft.salaryBasis || config.salaryBasisOptions[0]?.value || 'REVENUE'}
                        onValueChange={(value) => onChange({ salaryBasis: value })}
                    />
                </div>
            )}
            {draft.awardKind === 'FixedPercent' && (
                <FieldError className="-mt-2" message={errors.percent ?? errors.salaryBasis} />
            )}

            {draft.awardKind === 'FloatPercent' && (
                <FloatPercentFields
                    draft={draft}
                    config={config}
                    errors={errors}
                    onChange={onChange}
                    onChangeBorder={onChangeBorder}
                />
            )}
        </div>
    )
}
