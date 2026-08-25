import type { RuleFormCardProps } from './model/types.ts'
import { useRuleFormCard } from './model/useRuleFormCard.ts'
import { AmountField } from './ui/AmountField.tsx'
import { AwardSection } from './ui/AwardSection.tsx'
import { RuleFormCardFields } from './ui/RuleFormCardFields.tsx'
import { RuleFormCardFooter } from './ui/RuleFormCardFooter.tsx'
import { RuleFormCardHeader } from './ui/RuleFormCardHeader.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → `Список правил` → `Правило 3 ·
 * Раскрыто (новое)` (`F8JNuZ`) — the expanded rule card: header (index badge, name/meta, collapse,
 * delete — no role badge here, that sub-node is `enabled: false` in the design, role only shows on
 * collapsed rows), `Название`/`Роль`/`Тип`(/`Категория`) row, then a type-dependent body (`PayPerHour`'s
 * single rate field, or an `Award Options` `RadioCard` row plus its award-specific sub-fields — see
 * `config.awardOptionsByType`), and a footer with a hint plus "Отмена"/"Сохранить правило". Каждый
 * из этих блоков — свой файл в `ui/`, здесь остаётся только их сборка.
 *
 * Direction-agnostic since Фаза 4 (docs/salary-schema-creation-ui): everything that differs between
 * "Сервис"/"Магазин" — the type list, award options per type, salary-basis tabs, which types show a
 * category field — comes in through `config` (a `RuleFormConfig`, see `core/model/ruleFormConfig.ts`;
 * наборы — `service/model/ruleTypes.ts`'s `SERVICE_RULE_FORM_CONFIG` / `shop/model/ruleTypes.ts`'s
 * `SHOP_RULE_FORM_CONFIG`) rather than being imported directly, so this exact component
 * (award/thresholds included) renders both directions' cards — Pencil node `ZMEof` (Магазин) reuses
 * the same layout as `tSYIw` (Сервис) for this reason. The category field (node `vtDMA`) renders
 * only for `config.categoryRuleTypes` (`ProductSold`/`UsedProductSold`), never for service. The
 * order-type multiselect (Фаза 5, docs/service-plan-salary-rule-order-category-filter) renders
 * only for `config.orderTypeRuleTypes` (`OrderPayed`/`ServiceCompleted`), never for shop — the two
 * are mutually exclusive per direction, see `RuleFormCardFields.tsx`.
 *
 * Validation errors only ever come from a `resolveRuleDraft`/`resolveShopRuleDraft` call the parent
 * runs (via `onSave`, see `core/model/useSalaryRulesDraft.ts`'s `trySaveExpanded`) — this component
 * has no zod of its own, it just shows whatever `RuleFieldErrors` map that returns, cleared again on
 * the next successful save attempt (см. `model/useRuleFormCard.ts`).
 *
 * Фаза 5 (mobile adaptive): the field grid/award rows already collapse to a single column below
 * `sm:` (640px) via Tailwind, so most of this card needs no mobile-specific markup. The one field
 * whose *overlay* differs by breakpoint is the category combobox — `core/ui/CategoryField` mounts
 * both the `md:` popover and the mobile bottom sheet (node `xF4KU`), one hidden per breakpoint,
 * sharing this card's `draft.category`/`onChange` — see that component's own comments.
 */
export function RuleFormCard({
    draft,
    index,
    config,
    allowedRolesByType,
    isRoleTypesLoading,
    roleTypesError,
    categories,
    isCategoriesLoading,
    categoriesError,
    orderTypes,
    isOrderTypesLoading,
    orderTypesError,
    onChange,
    onChangeType,
    onChangeBorder,
    onCancel,
    onSave,
    onDelete,
    className,
}: RuleFormCardProps) {
    const {
        errors,
        allowedRoles,
        awardOptions,
        showCategory,
        showOrderTypeIds,
        patchDraft,
        changeBorder,
        handleTypeChange,
        handleAwardKindChange,
        handleSave,
        handleCollapse,
    } = useRuleFormCard({ draft, config, allowedRolesByType, onChange, onChangeType, onChangeBorder, onSave, onCancel })

    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-0 rounded-[10px] border border-brand-border bg-surface">
                <RuleFormCardHeader
                    draft={draft}
                    index={index}
                    categories={categories}
                    onCancel={handleCollapse}
                    onDelete={() => onDelete(draft.draftId)}
                />

                <div className="flex flex-col gap-3.5 p-3.5">
                    <RuleFormCardFields
                        draft={draft}
                        config={config}
                        errors={errors}
                        allowedRoles={allowedRoles}
                        isRoleTypesLoading={isRoleTypesLoading}
                        roleTypesError={roleTypesError}
                        categories={categories}
                        isCategoriesLoading={isCategoriesLoading}
                        categoriesError={categoriesError}
                        showCategory={showCategory}
                        orderTypes={orderTypes}
                        isOrderTypesLoading={isOrderTypesLoading}
                        orderTypesError={orderTypesError}
                        showOrderTypeIds={showOrderTypeIds}
                        onChange={patchDraft}
                        onChangeType={handleTypeChange}
                    />

                    <div className="h-px w-full bg-hairline" />

                    {/* Тип-зависимое тело: у `PayPerHour` это единственное поле ставки, у остальных
                        типов — блок «Вариант награды» с под-полями выбранного варианта. */}
                    {draft.type === 'PayPerHour' ? (
                        <AmountField
                            label="Ставка, ₽ / час"
                            value={draft.price}
                            placeholder="450"
                            error={errors.price}
                            onValueChange={(price) => patchDraft({ price })}
                        />
                    ) : (
                        <AwardSection
                            draft={draft}
                            config={config}
                            awardOptions={awardOptions}
                            errors={errors}
                            onChange={patchDraft}
                            onChangeBorder={changeBorder}
                            onAwardKindChange={handleAwardKindChange}
                        />
                    )}

                    <div className="h-px w-full bg-hairline" />

                    <RuleFormCardFooter confirmed={draft.confirmed} onCancel={onCancel} onSave={handleSave} />
                </div>
            </div>
        </div>
    )
}
