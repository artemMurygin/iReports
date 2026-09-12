import type { CatalogCategoryResponse, OrderTypeResponse, TargetRole } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { RuleDraft, RuleType } from '../../../model/ruleDraft.ts'
import { CategoryField } from '../../CategoryField'
import { OrderTypeField } from '../../OrderTypeField'

import { FieldError } from './FieldError.tsx'
import { RuleRoleField } from './RuleRoleField.tsx'

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
    onChange: (patch: Partial<RuleDraft>) => void
    onChangeType: (type: RuleType) => void
}

/**
 * Сетка основных полей карточки: `Название` / `Роль` / `Тип`(/`Категория` или `Типы заказов`).
 * Поле категории (node `vtDMA`) появляется только для типов из `config.categoryRuleTypes`
 * (`ProductSold`/`UsedProductSold`, магазин); поле типов заказов (Фаза 5,
 * docs/service-plan-salary-rule-order-category-filter) — только для `config.orderTypeRuleTypes`
 * (`OrderPayed`/`ServiceCompleted`, сервис). Ни у одного направления оба списка не пересекаются,
 * так что сетка переключается между 3 и 4 колонками на `sm:`, как и раньше.
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
    onChange,
    onChangeType,
}: RuleFormCardFieldsProps) {
    return (
        <div className={cn('grid grid-cols-1 gap-3', showCategory || showOrderTypeIds ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
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
    )
}
