import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { BorderDraft, RuleDraft } from '../../../model/ruleDraft.ts'
import { PercentSliderField } from '../../PercentSliderField'
import { ThresholdsEditor } from '../../ThresholdsEditor'

import { AmountField } from './AmountField.tsx'
import { FieldError } from './FieldError.tsx'
import { SalaryBasisField } from './SalaryBasisField.tsx'

export type FloatPercentMarginFloorFieldsProps = {
    draft: RuleDraft
    config: RuleFormConfig
    errors: RuleFieldErrors
    onChange: (patch: Partial<RuleDraft>) => void
    onChangeBorder: (index: number, patch: Partial<BorderDraft>) => void
}

/**
 * Под-поля награды `FloatPercentMarginFloor` («Продажа товара Б/У», shop `ProductSold`-only): те же
 * пороги/базовый процент/база начисления, что у `FloatPercentFields`, плюс порог маржи позиции,
 * минимальная сумма при марже не ниже порога и процент от цены продажи при марже ниже порога.
 */
export function FloatPercentMarginFloorFields({
    draft,
    config,
    errors,
    onChange,
    onChangeBorder,
}: FloatPercentMarginFloorFieldsProps) {
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
                        label="Базовый процент (при марже ≥ порога)"
                        value={draft.basePercent}
                        onValueChange={(value) => onChange({ basePercent: value })}
                        min={0}
                        max={50}
                        step={0.5}
                    />
                    <SalaryBasisField
                        options={config.salaryBasisOptions}
                        value={draft.salaryBasis || config.salaryBasisOptions[0]?.value || 'REVENUE'}
                        onValueChange={(value) => onChange({ salaryBasis: value })}
                    />
                </div>
                <FieldError message={errors.basePercent ?? errors.salaryBasis} />
            </div>

            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:gap-6">
                <AmountField
                    label="Порог маржи позиции, ₽"
                    value={draft.marginThreshold}
                    placeholder="1000"
                    error={errors.marginThreshold}
                    onValueChange={(marginThreshold) => onChange({ marginThreshold })}
                />
                <AmountField
                    label="Минимальная сумма при марже ≥ порога, ₽"
                    value={draft.floorAmount}
                    placeholder="500"
                    error={errors.floorAmount}
                    onValueChange={(floorAmount) => onChange({ floorAmount })}
                />
            </div>

            <div className="flex flex-col gap-1.5 sm:max-w-[320px]">
                <PercentSliderField
                    label="Процент от цены продажи (при марже < порога)"
                    value={draft.lowMarginPercent}
                    onValueChange={(value) => onChange({ lowMarginPercent: value })}
                    min={0}
                    max={5}
                    step={0.1}
                />
                <FieldError message={errors.lowMarginPercent} />
            </div>
        </div>
    )
}
