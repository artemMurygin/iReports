import type { CatalogCategoryResponse, OrderTypeResponse, TargetRole } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { BorderDraft, RuleDraft, RuleType } from '../../../model/ruleDraft.ts'
import { CategoryField } from '../../CategoryField'
import { OrderTypeField } from '../../OrderTypeField'
import { PercentSliderField } from '../../PercentSliderField'
import { ThresholdsEditor } from '../../ThresholdsEditor'
import { WarehouseField, type WarehouseFieldWarehouse } from '../../WarehouseField'

import { AmountField } from './AmountField.tsx'
import { FieldError } from './FieldError.tsx'
import { RuleRoleField } from './RuleRoleField.tsx'
import { SalaryBasisField } from './SalaryBasisField.tsx'

export type RuleFormCardFieldsProps = {
    draft: RuleDraft
    config: RuleFormConfig
    errors: RuleFieldErrors
    allowedRoles: TargetRole[]
    isRoleTypesLoading: boolean
    roleTypesError?: string | null
    categories: CatalogCategoryResponse[]
    isCategoriesLoading?: boolean
    categoriesError?: string | null
    /** `config.categoryRuleTypes.includes(draft.type)` — считается в `model/useRuleFormCard.ts`. */
    showCategory: boolean
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading?: boolean
    orderTypesError?: string | null
    /** `config.orderTypeRuleTypes.includes(draft.type)` — считается в `model/useRuleFormCard.ts`.
     * Никогда не `true` одновременно с `showCategory` (Фаза 5, см. `ruleFormConfig.ts`'s комментарий
     * про `orderTypeRuleTypes`), поэтому оба поля делят одну и ту же 4-ю колонку сетки. */
    showOrderTypeIds: boolean
    /** `DepartmentPlanBonus`/`DepartmentTurnoverBonus` only (FR3/FR4) — forwarded as-is to
     * `ThresholdsEditor`, same bound-per-draft callback `AwardSection`'s `FloatPercent` sub-fields
     * already receive from `RuleFormCard.tsx`'s `useRuleFormCard`'s `changeBorder`. */
    onChangeBorder: (index: number, patch: Partial<BorderDraft>) => void
    /** `DepartmentTurnoverBonus` only (FR4) — the warehouse picklist for `WarehouseField`. Optional/
     * defaults to `[]` so existing callers (none of the other 6 rule types read it) don't need to
     * thread real data through until a page actually fetches it. */
    warehouses?: WarehouseFieldWarehouse[]
    isWarehousesLoading?: boolean
    warehousesError?: string | null
    onChange: (patch: Partial<RuleDraft>) => void
    onChangeType: (type: RuleType) => void
}

/**
 * Implements FR2, FR3, FR4 of add-department-head-salary-rules.
 *
 * Сетка основных полей карточки: `Название` / `Роль` / `Тип`(/`Категория` или `Типы заказов`).
 * Поле категории (node `vtDMA`) появляется только для типов из `config.categoryRuleTypes`
 * (`ProductSold`/`UsedProductSold`, магазин); поле типов заказов (Фаза 5,
 * docs/service-plan-salary-rule-order-category-filter) — только для `config.orderTypeRuleTypes`
 * (`OrderPayed`/`ServiceCompleted`, сервис). Ни у одного направления оба списка не пересекаются,
 * так что сетка переключается между 3 и 4 колонками на `sm:`, как и раньше.
 *
 * После этой сетки — 3 самостоятельные ветки рендера для новых видов правил уровня отдела/
 * направления (`DepartmentPercent`/`DepartmentPlanBonus`/`DepartmentTurnoverBonus`), каждая под
 * свой `draft.type === '...'`, а не через `config.awardOptionsByType`/`AwardSection` — у этих 3
 * видов нет «Варианта награды» вовсе (`ruleAwards.ts`'s `AWARD_OPTIONS_BY_TYPE`/
 * `SHOP_AWARD_OPTIONS_BY_TYPE` уже заводят для них пустой массив, ui-design.md «Отклонения»), их
 * тело целиком рендерится прямо здесь, вместо `RuleFormCard.tsx`'s `AwardSection` (которая для
 * этих типов не вызывается вовсе — см. `DEPARTMENT_RULE_TYPES` в `model/ruleDraft.ts`). Поля читаются
 * через `mcp__pencil__execute`/`Get` по точным Node ID из `design/sallary-first-iteration.pen`:
 * - `DepartmentPercent` (FR2) — desktop `x8OVx`, mobile 390 `ThvHu`: `Категория` + `База начисления`
 *   + `Процент от факта` (слайдер, `PercentSliderField`).
 * - `DepartmentPlanBonus` (FR3) — desktop `O9tPQ`, mobile 390 `sHiW6`: `Категория` + `База начисления`
 *   + `Фиксированная сумма, ₽` (`AmountField`) + пороги (`ThresholdsEditor`, переиспользуется как есть).
 * - `DepartmentTurnoverBonus` (FR4) — desktop `WdQo0`, mobile 390 `PXeac`: `Склад` (обязательный,
 *   `WarehouseField`) + `Категория` (опционально) + `Фиксированная сумма, ₽` + `План коэффициента
 *   оборачиваемости` + пороги — без `База начисления` (оборачиваемость — не денежная база).
 *
 * Фаза 5 mobile pattern: как и у остальных полей этой карточки, каждая ветка — один и тот же
 * `grid grid-cols-1 sm:grid-cols-N` (стекается в один столбец ниже `sm:`, 640px), плюс уже
 * mobile-адаптивные `PercentSliderField`/`SalaryBasisField`/`ThresholdsEditor`/`CategoryField` —
 * отдельной мобильной разметки не потребовалось (сверено со скриншотами карточек `ThvHu`/`sHiW6`/
 * `PXeac` при ширине 390).
 */
export function RuleFormCardFields({
    draft,
    config,
    errors,
    allowedRoles,
    isRoleTypesLoading,
    roleTypesError,
    categories,
    isCategoriesLoading,
    categoriesError,
    showCategory,
    orderTypes,
    isOrderTypesLoading,
    orderTypesError,
    showOrderTypeIds,
    onChangeBorder,
    warehouses,
    isWarehousesLoading,
    warehousesError,
    onChange,
    onChangeType,
}: RuleFormCardFieldsProps) {
    return (
        <>
            <div
                className={cn(
                    'grid grid-cols-1 gap-3',
                    showCategory || showOrderTypeIds ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
                )}
            >
                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted">Название правила</label>
                    <Input
                        value={draft.name}
                        onChange={(event) => onChange({ name: event.target.value })}
                        placeholder="Например, Оплата за час"
                    />
                    <FieldError message={errors.name} />
                </div>

                <RuleRoleField
                    value={draft.targetRole ?? ''}
                    allowedRoles={allowedRoles}
                    isLoading={isRoleTypesLoading}
                    loadError={roleTypesError}
                    error={errors.targetRole}
                    onValueChange={(targetRole) => onChange({ targetRole })}
                />

                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted">Тип правила</label>
                    <Select value={draft.type} onValueChange={(value) => onChangeType(value as RuleType)}>
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
                        <CategoryField
                            value={draft.category}
                            onValueChange={(category) => onChange({ category })}
                            categories={categories}
                            isLoading={isCategoriesLoading}
                            error={categoriesError}
                        />
                        <FieldError message={errors.category} />
                    </div>
                )}

                {showOrderTypeIds && (
                    <div className="flex flex-col gap-1.5">
                        <label className="font-ui text-xs font-medium text-ink-muted">Типы заказов</label>
                        <OrderTypeField
                            value={draft.orderTypeIds}
                            onValueChange={(orderTypeIds) => onChange({ orderTypeIds })}
                            orderTypes={orderTypes}
                            isLoading={isOrderTypesLoading}
                            error={orderTypesError}
                        />
                    </div>
                )}
            </div>

            {draft.type === 'DepartmentPercent' && (
                <>
                    <div className="h-px w-full bg-hairline" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted">Категория</label>
                            <CategoryField
                                value={draft.category}
                                onValueChange={(category) => onChange({ category })}
                                categories={categories}
                                isLoading={isCategoriesLoading}
                                error={categoriesError}
                            />
                            <FieldError message={errors.category} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <PercentSliderField
                                className="max-w-[320px]"
                                label="Процент от факта"
                                value={draft.percent}
                                onValueChange={(percent) => onChange({ percent })}
                            />
                            <FieldError message={errors.percent} />
                        </div>

                        <SalaryBasisField
                            options={config.salaryBasisOptions}
                            value={draft.salaryBasis || config.salaryBasisOptions[0]?.value || 'REVENUE'}
                            onValueChange={(salaryBasis) => onChange({ salaryBasis })}
                        />
                    </div>
                    <FieldError message={errors.salaryBasis} />
                </>
            )}

            {draft.type === 'DepartmentPlanBonus' && (
                <>
                    <div className="h-px w-full bg-hairline" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted">Категория</label>
                            <CategoryField
                                value={draft.category}
                                onValueChange={(category) => onChange({ category })}
                                categories={categories}
                                isLoading={isCategoriesLoading}
                                error={categoriesError}
                            />
                            <FieldError message={errors.category} />
                        </div>

                        <AmountField
                            label="Фиксированная сумма, ₽"
                            value={draft.price}
                            placeholder="25000"
                            error={errors.price}
                            onValueChange={(price) => onChange({ price })}
                        />

                        <SalaryBasisField
                            options={config.salaryBasisOptions}
                            value={draft.salaryBasis || config.salaryBasisOptions[0]?.value || 'REVENUE'}
                            onValueChange={(salaryBasis) => onChange({ salaryBasis })}
                        />
                    </div>
                    <FieldError message={errors.salaryBasis} />

                    <ThresholdsEditor
                        borders={draft.percentBorders}
                        expanded={draft.thresholdsExpanded}
                        onToggleExpanded={() => onChange({ thresholdsExpanded: !draft.thresholdsExpanded })}
                        onChangeBorder={onChangeBorder}
                        error={errors.thresholds}
                    />
                </>
            )}

            {draft.type === 'DepartmentTurnoverBonus' && (
                <>
                    <div className="h-px w-full bg-hairline" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted">Склад</label>
                            <WarehouseField
                                value={draft.warehouseId}
                                onValueChange={(warehouseId) => onChange({ warehouseId })}
                                warehouses={warehouses ?? []}
                                isLoading={isWarehousesLoading}
                                error={warehousesError}
                            />
                            <FieldError message={errors.warehouseId} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted">Категория</label>
                            <CategoryField
                                value={draft.category}
                                onValueChange={(category) => onChange({ category })}
                                categories={categories}
                                isLoading={isCategoriesLoading}
                                error={categoriesError}
                            />
                            <FieldError message={errors.category} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <AmountField
                            label="Фиксированная сумма, ₽"
                            value={draft.price}
                            placeholder="18000"
                            error={errors.price}
                            onValueChange={(price) => onChange({ price })}
                        />

                        <AmountField
                            label="План коэффициента оборачиваемости"
                            value={draft.planTurnoverRatio}
                            placeholder="1,0"
                            error={errors.planTurnoverRatio}
                            onValueChange={(planTurnoverRatio) => onChange({ planTurnoverRatio })}
                        />
                    </div>

                    <ThresholdsEditor
                        borders={draft.percentBorders}
                        expanded={draft.thresholdsExpanded}
                        onToggleExpanded={() => onChange({ thresholdsExpanded: !draft.thresholdsExpanded })}
                        onChangeBorder={onChangeBorder}
                        error={errors.thresholds}
                    />
                </>
            )}
        </>
    )
}
