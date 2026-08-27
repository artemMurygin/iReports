import type { TargetRole } from 'ireports-contracts'

import type { ServiceRuleType, ShopRuleType } from '@/kernel/ruleTypeLabels.ts'

/**
 * `ServiceRuleType`/`ShopRuleType` moved to `kernel/ruleTypeLabels.ts` (needed by
 * `pages/SalaryRuleList` too, which can't import another page) — re-exported here so this file's
 * existing consumers keep working unchanged.
 */
export type { ServiceRuleType, ShopRuleType }

/**
 * One flat draft (below) is reused for both directions' rule cards, so this is the union of both —
 * NOT a merged/mixed contract type (that stays strictly separate, see `service/model/ruleFormSchema.ts`
 * vs `shop/model/ruleFormSchema.ts`): purely the set of string values `draft.type` can hold while being
 * edited. Which subset is actually offered/valid for the currently selected direction is decided by
 * `RuleFormConfig.ruleTypeOrder` (`service/model/ruleTypes.ts`/`shop/model/ruleTypes.ts`), not by this type.
 */
export type RuleType = ServiceRuleType | ShopRuleType

/** Union of every `award.type` across the 3 award-bearing rule types — which subset applies to a
 * given `RuleType` is `service/model/ruleTypes.ts`'s `AWARD_OPTIONS_BY_TYPE`. */
export type AwardKind = 'Fixed' | 'ServiceFixed' | 'ServicePercent' | 'FixedPercent' | 'FloatPercent'

export type BorderMode = 'FIX' | 'LINEAR'

export type SalaryBasisValue = 'REVENUE' | 'MARGIN' | 'SALARY_MINUS_ENGINEER_SALARY'

/** One row of `percentBorders` while being edited — numeric fields stay strings (same "text input,
 * parse on submit" convention as Фаза 2's `rate`, see `SalaryRulesRuleCard.tsx`) so the input can
 * hold transient states like `""`/`"1,"` while typing. */
export type BorderDraft = {
    name: string
    fromPlanPercent: string
    multiplier: string
    mode: BorderMode
}

/**
 * Flat draft for one rule card. Reused as-is across all 4 `RuleType`s (fields irrelevant to the
 * current `type`/`awardKind` are simply unread) rather than 4 separate draft shapes — mirrors
 * `frontend/CLAUDE.md`'s "model-хуки с плоским объектом состояния" spirit: one shape, one set of
 * change handlers, the *rendered* form (`core/ui/RuleFormCard`) is what varies by type.
 *
 * `percentBorders` is a plain array (not a fixed 3-tuple) on purpose, even though the UI never
 * offers add/remove controls for it (`ThresholdsEditor` always renders exactly 3 rows) — this
 * keeps the "exactly 3 borders" rule a real runtime check in `service/model/ruleFormSchema.ts`
 * (`resolveRuleDraft`) instead of something only TypeScript enforces, which is what makes it a
 * meaningful case for the unit test the phase asks for.
 */
export type RuleDraft = {
    draftId: string
    /** Whether this draft was ever accepted via "Сохранить правило" — decides what "Отмена"/
     * collapsing does (see `useSalaryRulesDraft.ts`): a draft added via "Добавить правило" and
     * never confirmed is discarded on cancel/collapse; a confirmed one just collapses. */
    confirmed: boolean
    type: RuleType
    name: string
    targetRole: TargetRole | ''
    /** `PayPerHour.config.price`, award `Fixed.price` and `TaskCompleted.config.rewardAmount`
     * (change salary-rule-bitrix-task) share this field (only one is ever read, depending on
     * `type`/`awardKind`). */
    price: string
    awardKind: AwardKind | ''
    /** `ServicePercent.percent` / `FixedPercent.percent`. */
    percent: string
    /** `FloatPercent.basePercent` (`OrderPayed`/`ProductSold` only). */
    basePercent: string
    salaryBasis: SalaryBasisValue | ''
    percentBorders: BorderDraft[]
    thresholdsExpanded: boolean
    /** `ProductSold.config.category` / `UsedProductSold.config.category` (Фаза 4, shop only) — id of
     * a `MoySkladProductFolder` node, or `null` for "все категории". Contract-required (nullable,
     * never absent — see `contracts/commands/shop-salary-rule.ts`), so the draft always carries a
     * value; `null` is the deliberate default (see `createRuleDraft`), not an unset/error state. Read
     * only for `ProductSold`/`UsedProductSold`; ignored otherwise. */
    category: string | null
    /** `OrderPayed.config.orderTypeIds` / `ServiceCompleted.config.orderTypeIds` (Фаза 5,
     * docs/service-plan-salary-rule-order-category-filter, service only) — id'ы `RoappOrderType`
     * (`RoappOrder.orderTypeId`), НЕ `SalesPlan.category`/`RoappServiceCategory`/`RoappProductCategory`.
     * `[]` — «учитывать заказы всех типов», как и на бэкенде для отсутствующего/пустого поля (см.
     * `orderPayedSalaryConfigSchema`/`serviceCompletedSalaryConfigSchema` в `contracts/commands/salary-rule.ts`),
     * поэтому черновик всегда несёт значение (never `undefined`), а не отдельное "не задано" состояние.
     * Read only for `OrderPayed`/`ServiceCompleted`; ignored otherwise. */
    orderTypeIds: number[]
    /** `TaskCompleted.config.description` (change salary-rule-bitrix-task) — текст задачи Bitrix24,
     * создаваемой при сохранении правила. Read only for `TaskCompleted`; ignored otherwise. */
    description: string
    /** `TaskCompleted.config.period` (`taskCompletedSalaryConfigSchema`) — расчётный месяц правила
     * на момент создания/редактирования (`YYYY-MM`), в границах которого обязан лежать `dueDate`
     * (design.md, Decision 9). НЕ то же самое, что текущий расчётный месяц, который задача
     * обслуживает в моменте после переноса в Bitrix24 (design.md, Decision 1/7) — это поле только
     * для формы создания/редактирования. Read only for `TaskCompleted`; ignored otherwise. */
    period: string
    /** `TaskCompleted.config.isRecurring` — разовое правило или регулярное (создаёт новую задачу
     * каждый месяц, см. `TaskRuleAutoCreationCron`). Read only for `TaskCompleted`; ignored
     * otherwise. */
    isRecurring: boolean
    /** `TaskCompleted.config.dueDate` (`YYYY-MM-DD`) — дедлайн задачи, обязан лежать в границах
     * `period` (design.md, Decision 9, `taskCompletedDueDateBounds`). Read only for `TaskCompleted`;
     * ignored otherwise. */
    dueDate: string
}

/** Текущий месяц (`YYYY-MM`) — дефолтный расчётный период нового правила-задачи
 * (`TaskCompleted.config.period`), тот же приём, что и `SalaryReportData`'s `getCurrentPeriod`
 * (руководитель обычно заводит задачу на текущий месяц, а не оставляет период пустым). */
function currentPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Default 3 threshold rows — pre-filled with the mockup's own example values (`design/
 * sallary-first-iteration.pen`, node `l0o4nP`) as a sensible starting template a user overwrites,
 * rather than empty rows for a field with no natural zero-default. */
export function defaultBorders(): BorderDraft[] {
    return [
        { name: 'Ниже плана', fromPlanPercent: '0', multiplier: '0.5', mode: 'FIX' },
        { name: 'Выполнение плана', fromPlanPercent: '70', multiplier: '1', mode: 'LINEAR' },
        { name: 'Перевыполнение', fromPlanPercent: '120', multiplier: '1.2', mode: 'FIX' },
    ]
}

export function createRuleDraft(type: RuleType = 'PayPerHour'): RuleDraft {
    return {
        draftId: crypto.randomUUID(),
        confirmed: false,
        type,
        name: '',
        targetRole: '',
        price: '',
        awardKind: '',
        percent: '',
        basePercent: '',
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: null,
        orderTypeIds: [],
        description: '',
        period: currentPeriod(),
        isRecurring: false,
        dueDate: '',
    }
}

/** Switching "Тип правила" clears every award-specific field (the previous type's `awardKind`/
 * price/percent/etc. have no meaning under the new type) but keeps `name` — the role is reset by
 * the caller only if it falls outside the new type's `allowedRoles` (`core/ui/RuleFormCard`),
 * not unconditionally here, since `resetAwardFields` doesn't know the allowed-roles list. */
export function resetAwardFields(draft: RuleDraft, nextType: RuleType): RuleDraft {
    return {
        ...draft,
        type: nextType,
        awardKind: '',
        price: '',
        percent: '',
        basePercent: '',
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: null,
        orderTypeIds: [],
        description: '',
        period: currentPeriod(),
        isRecurring: false,
        dueDate: '',
    }
}
