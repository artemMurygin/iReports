import { useState } from 'react'
import { Check, ChevronUp, Trash2 } from 'lucide-react'
import type { CatalogCategoryResponse, TargetRole } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { RadioCard } from '@/shared/ui-kit/atoms/RadioCard'
import { SegmentedControl } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import type { RuleFieldErrors } from '../model/formNumberUtils.ts'
import { ROLE_LABELS } from '../model/roleLabels.ts'
import type { RuleFormConfig } from '../model/ruleTypes.ts'
import { summarizeRuleDraft } from '../model/ruleSummary.ts'
import type { RuleSaveOutcome } from '../model/useSalaryRulesDraft.ts'
import { type AwardKind, type BorderDraft, type RuleDraft, type RuleType, type SalaryBasisValue } from '../model/ruleDraft.ts'

import { CategoryBottomSheet } from './CategoryBottomSheet.tsx'
import { CategoryCombobox } from './CategoryCombobox.tsx'
import { PercentSliderField } from './PercentSliderField.tsx'
import { ThresholdsEditor } from './ThresholdsEditor.tsx'

/**
 * "База начисления" field — Pencil node `Qw1Bv`/`I3Am6j`: the horizontal 2–3 option
 * `SegmentedControl` on `md:` and up, but a `vertical`-oriented one (one full-width row per
 * option) below it. Needed because the horizontal layout's `flex-1` tabs can't fit
 * `SALARY_MINUS_ENGINEER_SALARY`'s label ("Маржа - начисление инженера") at phone width without
 * overflowing the card — see `SegmentedControl`'s own comment on the `orientation` prop. Both
 * `SegmentedControl`s are mounted (one hidden per breakpoint, same `value`/`onValueChange`), the
 * same pattern used throughout Фаза 5 rather than a JS width check.
 */
function SalaryBasisField({
    options,
    value,
    onValueChange,
}: {
    options: RuleFormConfig['salaryBasisOptions']
    value: SalaryBasisValue
    onValueChange: (value: SalaryBasisValue) => void
}) {
    return (
        <div className="flex flex-1 flex-col gap-1.5">
            <span className="font-ui text-xs font-medium text-ink-muted">База начисления</span>
            <SegmentedControl aria-label="База начисления" options={options} value={value} onValueChange={onValueChange} className="hidden md:flex" />
            <SegmentedControl
                aria-label="База начисления"
                options={options}
                value={value}
                onValueChange={onValueChange}
                orientation="vertical"
                className="flex md:hidden"
            />
        </div>
    )
}

export type SalaryRulesRuleFormCardProps = {
    draft: RuleDraft
    index: number
    config: RuleFormConfig
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    isRoleTypesLoading: boolean
    roleTypesError?: string | null
    categories: CatalogCategoryResponse[]
    isCategoriesLoading?: boolean
    categoriesError?: string | null
    onChange: (patch: Partial<RuleDraft>) => void
    onChangeType: (type: RuleType) => void
    onChangeBorder: (index: number, patch: Partial<BorderDraft>) => void
    onCancel: () => void
    onSave: () => RuleSaveOutcome | null
    onDelete: () => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → `Список правил` → `Правило 3 ·
 * Раскрыто (новое)` (`F8JNuZ`) — the expanded rule card: header (index badge, name/meta, collapse,
 * delete — no role badge here, that sub-node is `enabled: false` in the design, role only shows on
 * collapsed rows), `Название`/`Роль`/`Тип`(/`Категория`) row, then a type-dependent body (`PayPerHour`'s
 * single rate field, or an `Award Options` `RadioCard` row plus its award-specific sub-fields — see
 * `config.awardOptionsByType`), an optional bonus field, and a footer with a hint plus "Отмена"/
 * "Сохранить правило".
 *
 * Direction-agnostic since Фаза 4 (docs/salary-schema-creation-ui): everything that differs between
 * "Сервис"/"Магазин" — the type list, award options per type, salary-basis tabs, which types show a
 * category field — comes in through `config` (a `RuleFormConfig`, see `model/ruleTypes.ts`'s
 * `SERVICE_RULE_FORM_CONFIG` / `model/shopRuleTypes.ts`'s `SHOP_RULE_FORM_CONFIG`) rather than being
 * imported directly, so this exact component (award/thresholds included) renders both directions'
 * cards — Pencil node `ZMEof` (Магазин) reuses the same layout as `tSYIw` (Сервис) for this reason.
 * The category field (node `vtDMA`) renders only for `config.categoryRuleTypes` (`ProductSold`/
 * `UsedProductSold`), never for service.
 *
 * Validation errors only ever come from a `resolveRuleDraft`/`resolveShopRuleDraft` call the parent
 * runs (via `onSave`, see `useSalaryRulesDraft.trySaveExpanded`) — this component has no zod of its
 * own, it just shows whatever `RuleFieldErrors` map that returns, cleared again on the next
 * successful save attempt.
 *
 * Фаза 5 (mobile adaptive): the field grid/award rows already collapse to a single column below
 * `sm:` (640px) via Tailwind, so most of this card needs no mobile-specific markup. The one field
 * whose *overlay* differs by breakpoint is the category combobox — both `CategoryCombobox` (`md:`
 * popover) and `CategoryBottomSheet` (mobile bottom sheet, node `xF4KU`) are mounted, one hidden per
 * breakpoint, sharing this card's `draft.category`/`onChange` — see those files' own comments.
 */
export function SalaryRulesRuleFormCard({
    draft,
    index,
    config,
    allowedRolesByType,
    isRoleTypesLoading,
    roleTypesError,
    categories,
    isCategoriesLoading,
    categoriesError,
    onChange,
    onChangeType,
    onChangeBorder,
    onCancel,
    onSave,
    onDelete,
    className,
}: SalaryRulesRuleFormCardProps) {
    const [errors, setErrors] = useState<RuleFieldErrors>({})

    const allowedRoles = allowedRolesByType[draft.type] ?? []
    const awardOptions = config.awardOptionsByType[draft.type] ?? []
    const showCategory = config.categoryRuleTypes.includes(draft.type)

    function handleTypeChange(nextType: RuleType) {
        onChangeType(nextType)
        const nextAllowedRoles = allowedRolesByType[nextType] ?? []
        if (draft.targetRole && !nextAllowedRoles.includes(draft.targetRole)) {
            onChange({ targetRole: '' })
        }
        setErrors({})
    }

    function handleAwardKindChange(kind: AwardKind) {
        onChange({ awardKind: kind })
        setErrors({})
    }

    function handleSave() {
        const result = onSave()
        if (result && !result.success) setErrors(result.errors)
    }

    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-0 rounded-[10px] border border-brand-border bg-surface">
                <div className="flex items-center justify-between gap-2.5 rounded-t-[10px] bg-brand-soft p-[10px_12px]">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border border-brand-strong bg-brand-strong font-ui text-[11px] font-semibold text-brand-foreground">
                            {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-ui text-[13px] font-semibold text-ink">
                                {draft.name.trim() || `Правило ${index + 1}`}
                            </span>
                            <span className="truncate font-ui text-[11px] text-ink-muted">
                                {draft.confirmed ? summarizeRuleDraft(draft, categories) : 'Новое правило'}
                            </span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            type="button"
                            onClick={onCancel}
                            aria-label="Свернуть правило"
                            className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                        >
                            <ChevronUp className="size-[15px]" />
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            aria-label="Удалить правило"
                            className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                            <Trash2 className="size-[15px]" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-3.5 p-3.5">
                    <div className={cn('grid grid-cols-1 gap-3', showCategory ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted">Название правила</label>
                            <Input
                                value={draft.name}
                                onChange={(event) => onChange({ name: event.target.value })}
                                placeholder="Например, Оплата за час"
                            />
                            {errors.name && <p className="font-ui text-xs text-danger">{errors.name}</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted">Роль</label>
                            <Select
                                value={draft.targetRole ?? ''}
                                onValueChange={(value) => onChange({ targetRole: value as TargetRole })}
                                disabled={isRoleTypesLoading || allowedRoles.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={
                                            isRoleTypesLoading ? 'Загрузка...' : roleTypesError ? 'Не удалось загрузить' : 'Выберите роль'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {allowedRoles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {ROLE_LABELS[role]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.targetRole && <p className="font-ui text-xs text-danger">{errors.targetRole}</p>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted">Тип правила</label>
                            <Select value={draft.type} onValueChange={(value) => handleTypeChange(value as RuleType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {config.ruleTypeOrder.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {config.ruleTypeLabels[type] ?? type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {showCategory && (
                            <div className="flex flex-col gap-1.5">
                                <label className="font-ui text-xs font-medium text-ink-muted">Категория товара</label>
                                <div className="hidden md:block">
                                    <CategoryCombobox
                                        value={draft.category}
                                        onValueChange={(category) => onChange({ category })}
                                        categories={categories}
                                        isLoading={isCategoriesLoading}
                                        error={categoriesError}
                                    />
                                </div>
                                <div className="md:hidden">
                                    <CategoryBottomSheet
                                        value={draft.category}
                                        onValueChange={(category) => onChange({ category })}
                                        categories={categories}
                                        isLoading={isCategoriesLoading}
                                        error={categoriesError}
                                    />
                                </div>
                                {errors.category && <p className="font-ui text-xs text-danger">{errors.category}</p>}
                            </div>
                        )}
                    </div>

                    <div className="h-px w-full bg-hairline" />

                    {draft.type === 'PayPerHour' ? (
                        <div className="flex flex-col gap-1.5 sm:w-[220px]">
                            <label className="font-ui text-xs font-medium text-ink-muted">Ставка, ₽ / час</label>
                            <Input
                                inputMode="decimal"
                                value={draft.price}
                                onChange={(event) => onChange({ price: event.target.value.replace(/[^0-9.,]/g, '') })}
                                placeholder="450"
                            />
                            {errors.price && <p className="font-ui text-xs text-danger">{errors.price}</p>}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3.5">
                            <div className="flex flex-col gap-2">
                                <span className="font-ui text-xs font-medium text-ink-muted">Вариант награды</span>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {awardOptions.map((option) => (
                                        <RadioCard
                                            key={option.kind}
                                            selected={draft.awardKind === option.kind}
                                            onSelect={() => handleAwardKindChange(option.kind)}
                                            title={option.title}
                                            description={option.description}
                                        />
                                    ))}
                                </div>
                                {errors.awardKind && <p className="font-ui text-xs text-danger">{errors.awardKind}</p>}
                            </div>

                            {draft.awardKind === 'Fixed' && (
                                <div className="flex flex-col gap-1.5 sm:w-[220px]">
                                    <label className="font-ui text-xs font-medium text-ink-muted">Сумма, ₽</label>
                                    <Input
                                        inputMode="decimal"
                                        value={draft.price}
                                        onChange={(event) => onChange({ price: event.target.value.replace(/[^0-9.,]/g, '') })}
                                        placeholder="300"
                                    />
                                    {errors.price && <p className="font-ui text-xs text-danger">{errors.price}</p>}
                                </div>
                            )}

                            {draft.awardKind === 'ServiceFixed' && (
                                <p className="font-ui text-xs text-ink-muted">
                                    Сумма подставится автоматически из карточки услуги в RemOnline при расчёте — вводить ставку не нужно.
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
                            {errors.percent && draft.awardKind === 'ServicePercent' && (
                                <p className="-mt-2 font-ui text-xs text-danger">{errors.percent}</p>
                            )}

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
                            {(errors.percent || errors.salaryBasis) && draft.awardKind === 'FixedPercent' && (
                                <p className="-mt-2 font-ui text-xs text-danger">{errors.percent ?? errors.salaryBasis}</p>
                            )}

                            {draft.awardKind === 'FloatPercent' && (
                                <div className="flex flex-col gap-3.5">
                                    <ThresholdsEditor
                                        borders={draft.percentBorders}
                                        expanded={draft.thresholdsExpanded}
                                        onToggleExpanded={() => onChange({ thresholdsExpanded: !draft.thresholdsExpanded })}
                                        onChangeBorder={onChangeBorder}
                                        error={errors.thresholds}
                                    />

                                    {draft.type === 'TaskCompleted' ? (
                                        <div className="flex flex-col gap-1.5 sm:w-[220px]">
                                            <label className="font-ui text-xs font-medium text-ink-muted">Базовая ставка, ₽</label>
                                            <Input
                                                inputMode="decimal"
                                                value={draft.basePrice}
                                                onChange={(event) => onChange({ basePrice: event.target.value.replace(/[^0-9.,]/g, '') })}
                                                placeholder="300"
                                            />
                                            {errors.basePrice && <p className="font-ui text-xs text-danger">{errors.basePrice}</p>}
                                        </div>
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
                                            {(errors.basePercent || errors.salaryBasis) && (
                                                <p className="font-ui text-xs text-danger">{errors.basePercent ?? errors.salaryBasis}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5 sm:w-[220px]">
                        <label className="font-ui text-xs font-medium text-ink-muted">Бонус (разово), ₽</label>
                        <Input
                            inputMode="decimal"
                            value={draft.bonus}
                            onChange={(event) => onChange({ bonus: event.target.value.replace(/[^0-9.,]/g, '') })}
                            placeholder="Необязательно"
                        />
                        {errors.bonus && <p className="font-ui text-xs text-danger">{errors.bonus}</p>}
                    </div>

                    <div className="h-px w-full bg-hairline" />

                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                        <p className="font-ui text-[11px] leading-[1.35] text-ink-muted">
                            {draft.confirmed ? 'Изменения обновят правило в схеме.' : 'Правило добавится в список схемы.'}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button type="button" variant="secondary" onClick={onCancel}>
                                Отмена
                            </Button>
                            <Button type="button" onClick={handleSave}>
                                <Check />
                                Сохранить правило
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
