import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { BorderDraft, RuleDraft } from '../../../model/ruleDraft.ts'
import { PercentSliderField } from '../../PercentSliderField'
import { ThresholdsEditor } from '../../ThresholdsEditor'

import { AmountField } from './AmountField.tsx'
import { FieldError } from './FieldError.tsx'
import { SalaryBasisField } from './SalaryBasisField.tsx'

export type FloatPercentFieldsProps = {
    draft: RuleDraft
    config: RuleFormConfig
    errors: RuleFieldErrors
    onChange: (patch: Partial<RuleDraft>) => void
    onChangeBorder: (index: number, patch: Partial<BorderDraft>) => void
}

/**
 * Под-поля награды `FloatPercent`: редактор порогов плюс база, от которой считается плавающий
 * процент — у `TaskCompleted` это базовая ставка в рублях (`basePrice`), у остальных типов
 * базовый процент со слайдером и «База начисления».
 */
export function FloatPercentFields({ draft, config, errors, onChange, onChangeBorder }: FloatPercentFieldsProps) {
    return (
        <div className="flex flex-col gap-3.5">
            <ThresholdsEditor
                borders={draft.percentBorders}
                expanded={draft.thresholdsExpanded}
                onToggleExpanded={() => onChange({ thresholdsExpanded: !draft.thresholdsExpanded })}
                onChangeBorder={onChangeBorder}
                error={errors.thresholds}
            />

            {draft.type === 'TaskCompleted' ? (
                <AmountField
                    label="Базовая ставка, ₽"
                    value={draft.basePrice}
                    placeholder="300"
                    error={errors.basePrice}
                    onValueChange={(basePrice) => onChange({ basePrice })}
                />
            ) : (
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:gap-6">
                        <PercentSliderField
                            className="max-w-[320px]"
                            label="Базовый процент"
                            value={draft.basePercent}
                            onValueChange={(value) => onChange({ basePercent: value })}
                        />
                        <SalaryBasisField
                            options={config.salaryBasisOptions}
                            value={draft.salaryBasis || config.salaryBasisOptions[0]?.value || 'REVENUE'}
                            onValueChange={(value) => onChange({ salaryBasis: value })}
                        />
                    </div>
                    <FieldError message={errors.basePercent ?? errors.salaryBasis} />
                </div>
            )}
        </div>
    )
}
