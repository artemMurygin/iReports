import type { MotivationRequest } from 'ireports-contracts'
import type { ServiceRuleType, ShopRuleType } from '@/kernel/ruleTypeLabels.ts'

/** Union of both directions' rule types, same shape as `pages/SalaryRules/model/ruleDraft.ts`'s own
 * `RuleType` — redeclared from the `kernel` halves rather than imported from that page (a page
 * cannot import another page's `model`, see frontend/CLAUDE.md). */
export type RuleType = ServiceRuleType | ShopRuleType

/** Same `targetType` union `MotivationRequest`/`ShopMotivationRequest` both already use — "Отдел"
 * или "Сотрудник" не зависит от направления (см. `SalaryRulesTargetCard.tsx`'s комментарий). */
export type SchemaTargetType = MotivationRequest['targetType']

/**
 * Pencil: design/sallary-first-iteration.pen, node `L5GclS` (`ERP/Organism/Schema Card`) — one row
 * of the merged `GET /v1/service/motivation-schema` + `GET /v1/shop/accounting/motivation-schema`
 * list (see `model/api.ts`'s `fetchMotivationSchemas`). Kept as this page's own flat shape rather
 * than importing `ireports-contracts`' `MotivationSchemaListItem`/`ShopMotivationSchemaListItem`
 * directly — those nest the target as `target: {type, id, name}`, while `deriveTargetOptions.ts`/
 * `filterSchemas.ts`/`SchemaGrid.tsx`/`SchemaListMobile.tsx` all work off flat `targetType`/
 * `targetId`/`targetName` fields; `model/api.ts` does the one-time adaptation at the fetch boundary.
 */
export type MotivationSchemaListItem = {
    id: string
    name: string
    direction: 'service' | 'shop'
    targetType: SchemaTargetType
    targetId: number
    targetName: string
    ruleCount: number
    /** Distinct rule types present in the schema, in the order they should render as chips — NOT
     * one entry per individual rule (a schema's `ruleCount` and `ruleTypes.length` happen to match
     * in every example in the mockup, since the mock schemas never repeat a type, but nothing here
     * assumes that: `ruleCount` is its own field). */
    ruleTypes: RuleType[]
    /** ISO 8601 timestamp — formatted for display by `formatUpdatedAt.ts`. */
    updatedAt: string
}
