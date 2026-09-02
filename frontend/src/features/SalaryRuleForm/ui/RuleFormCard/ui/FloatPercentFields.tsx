import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { BorderDraft, RuleDraft } from '../../../model/ruleDraft.ts'
import { PercentSliderField } from '../../PercentSliderField'
import { ThresholdsEditor } from '../../ThresholdsEditor'

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
 * Под-поля награды `FloatPercent`: редактор порогов плюс базовый процент со слайдером и «База
 * начисления» — единственная форма этого варианта с тех пор, как `TaskCompleted`'s `FloatPercent`
 * (свой вариант с базовой ставкой в рублях, `basePrice`) удалён вместе с award-union этого типа
 * (change salary-rule-bitrix-task, design.md Decision 2 — единственный вид вознаграждения теперь
 * фиксированная сумма, `AWARD_OPTIONS_BY_TYPE.TaskCompleted` пуст, эта форма для него больше не
 * рендерится).
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
        </div>
    )
}
